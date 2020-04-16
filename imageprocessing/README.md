# Image processing service

## Toolchain setup (assuming Linux)

1.	Install Rust by following the instructions at https://rustup.rs
2.	Install `musl` for your system (on Arch Linux, `pacman -S musl`)
3.	Install the Rust `musl` target with `rustup target add x86_64-unknown-linux-musl`

## AWS Setup

In general, follow the instructions [here][lambda-tutorial] up until the 'Create the Function' section.

[lambda-tutorial]: https://docs.aws.amazon.com/lambda/latest/dg/with-s3-example.html

## Build & Deploy

```bash
$ # Run these before every deploy & re-deploy
$ cargo build --release
$ cp ./target/x86_64-unknown-linux-musl/release/imageprocessing ./bootstrap \
	&& zip lambda.zip bootstrap \
	&& rm bootstrap
$ # Initial function creation - run this once
$ aws lambda create-function --function-name rustTest \                                   
	--handler provided \
	--zip-file fileb://lambda.zip \
	--runtime provided \
	--role <ROLE_ARN> \
    --memory-size 1024 \
	--environment Variables={DEST_BUCKET=<DEST-BUCKET-NAME>}
$ # Code update - run this before every re-deploy
$ aws lambda update-function-code \
	--function-name rustTest \
	--zip-file fileb://lambda.zip
```

## Logging

This service uses the [`log`] crate with a [`simple_logger`] frontend. The log level is determined
by the runtime environment variables. To set the log level:

```
$ aws lambda update-function-configuration --function-name rustTest --environment Variables={RUST_LOG=INFO}
```

Available levels: "OFF", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"

## Note about `musl`

Instead of trying to get `glibc` and OpenSSL linking to work properly, we will avoid the issue entirely by building a statically-linked binary. To accomplish this, we instead build against the `musl` toolchain and use a rust-native implementation of TLS/SSL, [`rustls`] where necessary.

[`rustls`]: https://crates.io/crates/rustls
