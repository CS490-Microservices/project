use {
    anyhow::{anyhow, ensure, Context as ErrorContext, Result},
    aws_lambda_events::event::s3::{S3Bucket, S3Entity, S3Event, S3EventRecord, S3Object},
    lambda_runtime::{error::HandlerError, lambda, Context},
    log::{debug, error},
    rusoto_core::Region,
    rusoto_s3::{GetObjectOutput, GetObjectRequest, S3Client, S3},
    serde::Serialize,
};

#[derive(Serialize)]
struct CustomOutput {
    key: String,
    src_bucket: String,
    len: Option<i64>,
    dest_key: String,
    dest_bucket: String,
}

fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    // Initialize the logger
    simple_logger::init_with_level(log::Level::Debug)
        .with_context(|| "Could not initialize logger")?;

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

    // Extract the key (image name) and the source bucket from the event
    let (key, src_bucket) = extract_key_src(event)
        .with_context(|| "Malformed event: could not extract key or source bucket")?;

    // Open a connection to S3
    let s3_client = S3Client::new(Region::default());

    // Download the object
    let object = download_object(&s3_client, key.clone(), src_bucket.clone())
        .with_context(|| anyhow!("Failed to download object"))?;

    debug!("Got object: {:#?}", object);
    let len = object.content_length;

    // Determine the output bucket & key
    let dest_key = format!("resized-{}", &key);
    let dest_bucket = format!("{}-resized", &src_bucket);

    Ok(CustomOutput {
        key,
        src_bucket,
        len,
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

    Ok(object)
}
