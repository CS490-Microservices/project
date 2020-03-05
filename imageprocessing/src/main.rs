use {
    anyhow::{anyhow, ensure, Context as ErrorContext, Result},
    aws_lambda_events::event::s3::{S3Bucket, S3Entity, S3Event, S3EventRecord, S3Object},
    image::{imageops::FilterType, GenericImageView, ImageFormat},
    lambda_runtime::{error::HandlerError, lambda, Context},
    log::{debug, error, info},
    rusoto_core::Region,
    rusoto_s3::{
        GetObjectOutput, GetObjectRequest, PutObjectOutput, PutObjectRequest, S3Client,
        StreamingBody, S3,
    },
    serde::Serialize,
    std::{
        convert::TryInto,
        io::{Cursor, Read},
        time::Instant,
    },
};

#[derive(Serialize)]
struct CustomOutput {
    key: String,
    src_bucket: String,
    src_len: Option<i64>,
    out_len: usize,
    dest_key: String,
    dest_bucket: String,
}

fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    // Initialize the logger
    simple_logger::init_by_env();

    // Run the lambda
    lambda!(handler);

    Ok(())
}

fn handler(event: S3Event, context: Context) -> std::result::Result<CustomOutput, HandlerError> {
    // Note: The error handling required by `lambda_runtime` is very un-idiomatic and appears to be
    // severely misguided. In a sane world, we wouldn't have to wrap this function and do the dumb
    // formatting and slicing of the actual error. This workaround causes us to lose lots of
    // context about the error that occured.

    // Execute the handler
    execute(&event, &context).map_err(|e| {
        // Print the full backtrace
        error!("{:?}", e);

        // Return the top-level error
        HandlerError::from(&format!("{}", e)[0..])
    })
}

fn execute(event: &S3Event, context: &Context) -> Result<CustomOutput> {
    let _ = context;
    let start = Instant::now();

    // Extract the key (image name) and the source bucket from the event
    let (key, src_bucket) = extract_key_src(event)
        .with_context(|| "Malformed event: could not extract key or source bucket")?;

    // Open a connection to S3
    let s3_client = S3Client::new(Region::default());

    let start_request = Instant::now();
    // Download the object
    let object = download_object(&s3_client, key.clone(), src_bucket.clone())
        .with_context(|| anyhow!("Failed to download object"))?;

    debug!("Request took {} ms", start_request.elapsed().as_millis());

    // The size of the image in bytes, lower-bounded by 1024 and upper-bounded by
    // `usize::max_value()`. The given size is an `i64`, so we try to cast it to a `usize` to
    // properly initialize the buffer.
    let len = object
        .content_length
        .unwrap_or(1024)
        .try_into()
        .unwrap_or(usize::max_value());
    let content_type = object.content_type;

    // Download image and load it into memory
    // TODO: improve this - couldn't get traits right on first try
    let start_read = Instant::now();
    let mut body = object.body.expect("already checked").into_blocking_read();
    let mut buffer = Vec::with_capacity(len);
    body.read_to_end(&mut buffer)?;
    let buffer = Cursor::new(buffer);
    debug!("Reading took {} ms", start_read.elapsed().as_millis());

    // Decode the image
    let start_decode = Instant::now();
    let image_format = ImageFormat::from_path(&key).with_context(|| "Error parsing image type")?;
    let image = image::load(buffer, image_format)
        .with_context(|| "Failed to load image - is it corrupted?")?;

    let dimensions = image.dimensions();
    info!(
        "Got image with dimensions: ({}, {})",
        dimensions.0, dimensions.1
    );
    debug!("Decoding took {} ms", start_decode.elapsed().as_millis());

    // Resize it
    let start_resize = Instant::now();
    let scaled = image.resize(400, 400, FilterType::Nearest); // TODO: better filter?
    let scaled_dimensions = scaled.dimensions();
    info!(
        "Resized image to dimensions: ({}, {})",
        scaled_dimensions.0, scaled_dimensions.1
    );
    debug!("Resizing took {} ms", start_resize.elapsed().as_millis());

    // Determine the output bucket & key
    let dest_key = format!("resized-{}", &key);
    let dest_bucket = format!("{}-resized", &src_bucket);

    // Re-encode the scaled image
    let start_encode = Instant::now();
    let mut out_buffer = Cursor::new(Vec::new());
    scaled.write_to(&mut out_buffer, image_format)?;
    let out_buffer = out_buffer.into_inner();
    let out_len = out_buffer.len();
    debug!("Encoding took {} ms", start_encode.elapsed().as_millis());

    let start_upload = Instant::now();
    upload_object(
        &s3_client,
        dest_key.clone(),
        dest_bucket.clone(),
        content_type,
        out_buffer,
    )
    .with_context(|| anyhow!("Failed to upload image to destination bucket"))?;

    info!(
        "Successfullly uploaded image to {}/{}",
        dest_bucket, dest_key
    );
    debug!("Upload took {} ms", start_upload.elapsed().as_millis());

    debug!("Everything took {} ms", start.elapsed().as_millis());

    Ok(CustomOutput {
        key,
        src_bucket,
        src_len: object.content_length,
        out_len: out_len,
        dest_key,
        dest_bucket,
    })
}

fn extract_key_src(event: &S3Event) -> Result<(String, String)> {
    // We'll only look at the first record for now
    // TODO: investigate the possibility of more records
    let event_record = &event.records[0];
    // Destructure the record to get what we need
    let S3EventRecord {
        s3:
            S3Entity {
                bucket: S3Bucket {
                    name: src_bucket, ..
                },
                object: S3Object { key, .. },
                ..
            },
        ..
    } = event_record;

    // Ensure we actually have the key
    let key = key.as_ref().ok_or_else(|| anyhow!("`key` required"))?;
    // The key is encoded like a url. Replace any `+` chars with spaces, then decode `%` escapes.
    let key = key.replace('+', " ");
    let key = urlencoding::decode(&key).map_err(|_| anyhow!("key decoding error"))?;

    // Ensure we actually have the bucket
    let src_bucket = src_bucket
        .as_ref()
        .ok_or_else(|| anyhow!("source bucket requried"))?;

    Ok((key, src_bucket.to_string()))
}

fn download_object(client: &S3Client, key: String, bucket: String) -> Result<GetObjectOutput> {
    // Build the request
    let request = GetObjectRequest {
        bucket: bucket.clone(),
        key: key.clone(),
        ..GetObjectRequest::default()
    };

    // Download the object
    let object = client.get_object(request).sync().with_context(|| {
        format!(
            "Object with key {} does not exist in bucket {}",
            key, bucket
        )
    })?;

    // Sanity check on content-type
    let content_type = object
        .content_type
        .as_ref()
        .ok_or_else(|| anyhow!("Object does not have content-type specified"))?;
    ensure!(
        content_type == "image/jpeg" || content_type == "image/png",
        "Received object is not a supported image type"
    );

    // Sanity check on the body
    ensure!(
        object.body.is_some(),
        "Received object does not have a body"
    );

    Ok(object)
}

fn upload_object(
    client: &S3Client,
    key: String,
    bucket: String,
    content_type: Option<String>,
    body: impl Into<StreamingBody>,
) -> Result<PutObjectOutput> {
    // Build the upload request
    let put_request = PutObjectRequest {
        body: Some(body.into()),
        bucket,
        key,
        content_type,
        ..Default::default()
    };

    // Upload the image
    let response = client.put_object(put_request).sync()?;

    Ok(response)
}
