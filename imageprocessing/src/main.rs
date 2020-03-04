use {
    anyhow::{anyhow, Result},
    aws_lambda_events::event::s3::{S3Bucket, S3Entity, S3Event, S3EventRecord, S3Object},
    lambda_runtime::{error::HandlerError, lambda, Context},
    serde::Serialize,
};

#[derive(Serialize)]
struct CustomOutput {
    key: String,
    src_bucket: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    simple_logger::init_with_level(log::Level::Debug)?;

    lambda!(handler);

    Ok(())
}

fn handler(event: S3Event, context: Context) -> std::result::Result<CustomOutput, HandlerError> {
    // Note: The error handling required by `lambda_runtime` is very un-idiomatic and appears to be
    // severely misguided. In a sane world, we wouldn't have to wrap this function and do the dumb
    // formatting and slicing of the actual error. This workaround causes us to lose lots of
    // context about the error that occured.
    execute(&event, &context).map_err(|e| HandlerError::from(&format!("{}", e)[0..]))
}

fn execute(event: &S3Event, context: &Context) -> Result<CustomOutput> {
    let _ = context;

    // Extract the key (image name) and the source bucket from the event
    let (key, src_bucket) = extract_key_src(event)?;

    Ok(CustomOutput { key, src_bucket })
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
