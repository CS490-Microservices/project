import React, { Component, Fragment } from 'react';
import { Stack } from 'office-ui-fabric-react/lib/Stack';
import { Card, CardItem } from '@uifabric/react-cards';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Overlay, Modal, DefaultButton } from 'office-ui-fabric-react';

import "./Home.css";

export default class Home extends Component {
    constructor(props) {
        super(props)

        this.state = {
            images: [],
            overlayHidden: true,
            uploading: false,
            currentImage: null
        }

        this.getAllImages = this.getAllImages.bind(this);
        this.uploadImage = this.uploadImage.bind(this);
        this.onDragEnter = this.onDragEnter.bind(this);
        this.onDragLeave = this.onDragLeave.bind(this);
        this.onDrop = this.onDrop.bind(this);
        this.getBase64 = this.getBase64.bind(this);

        window.addEventListener("dragover", function (e) {
            e.preventDefault();
        }, false);
        window.addEventListener("drop", function (e) {
            e.preventDefault();
        }, false);
    }

    componentDidMount() {
        this.getAllImages();
    }

    getAllImages() {
        fetch("https://iuk6w4fn0h.execute-api.us-east-1.amazonaws.com/getImage")
            .then(data => data.json())
            .then(data => {
                this.setState({ images: data })
            })
    }

    uploadImage(data, type) {
        return new Promise((resolve, _) => {
            fetch(`https://iuk6w4fn0h.execute-api.us-east-1.amazonaws.com/uploadImage`, {
                method: "POST",
                body: JSON.stringify({
                    username: 'test',
                    content: data,
                    type
                })
            }).then(_ => {
                resolve();
            })
        });
    }

    onDragEnter(e) {
        e.stopPropagation();
        e.preventDefault();
        this.setState({ overlayHidden: false });
    }

    onDragLeave(e) {
        e.stopPropagation();
        e.preventDefault();
        if (e.pageX === 0 || e.pageY === 0) {
            this.setState({ overlayHidden: true });
        }
    }

    getBase64(file) {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
        });
    }

    async onDrop(e) {
        e.stopPropagation();
        e.preventDefault();
        this.setState({ uploading: true })
        const uploads = [];
        for (const file of e.dataTransfer.files) {
            if (file.type === "image/png" || file.type === "image/jpeg") {
                const base64 = await this.getBase64(file);
                uploads.push(this.uploadImage(base64, file.type));
            }
        }

        Promise.all(uploads).then(_ => {
            this.setState({ uploading: false, overlayHidden: true });
            setTimeout(() => {
                this.getAllImages();
            }, 2000);
        });
    }

    render() {
        const { images, overlayHidden, uploading, currentImage } = this.state;

        return (
            <Fragment>
                <div id="drop" onDragEnter={this.onDragEnter} onDragLeave={this.onDragLeave} onDrop={this.onDrop}>
                    <h1>Images</h1>
                    <Stack
                        horizontal
                        verticalFill
                        wrap
                        horizontalAlign="center"
                        tokens={{ childrenGap: 30 }}
                    >
                        {
                            images.map(image => {
                                const imageSrc = `https://image-host-processed-images.s3.amazonaws.com/${image.path}`;
                                return (
                                    <Card horizontal horizontalAlign="center" key={image.path} styles={{ root: { backgroundColor: 'white' } }}>
                                        <CardItem>
                                            <div className="image-container" onClick={() => { this.setState({ currentImage: image }) }}>
                                                <img className="image" src={imageSrc} alt="view" />
                                            </div>
                                        </CardItem>
                                    </Card>
                                )
                            })
                        }
                    </Stack>
                    {
                        overlayHidden ? null : (
                            <Overlay isDarkThemed={true} >
                                <div className="overlay">
                                    <div className="overlay-content">
                                        {
                                            uploading ? (
                                                <Spinner label="Uploading..." size={SpinnerSize.large} />
                                            ) : (
                                                    <h1>Drop Files To Upload</h1>
                                                )
                                        }

                                    </div>
                                </div>
                            </Overlay>
                        )
                    }
                </div>
                {currentImage !== null ? (
                    <Modal
                        isOpen={currentImage !== null}
                        isBlocking={false}
                        onDismiss={() => { this.setState({ currentImage: null }) }}
                        styles={{ main: { borderRadius: 5 } }}
                    >
                        <Stack horizontal horizontalAlign="center" tokens={{ childrenGap: 16 }}>
                            <Card horizontal styles={{ root: { maxWidth: '900px' } }}>
                                <Card.Section>

                                    <Stack horizontal>
                                        <div style={{ margin: '16px' }}>
                                            <Card horizontal>
                                                <img src={`https://image-host-processed-images.s3.amazonaws.com/${currentImage.path}`} alt="view" />
                                            </Card>
                                        </div>
                                        <Stack>
                                            <div style={{ width: 400 }}>
                                                <p>Uploaded by: {currentImage.user}</p>
                                                <p>Tag: {currentImage.tag === null ? "None" : currentImage.tag}</p>
                                                <DefaultButton
                                                styles={{root: {position: 'absolute', bottom: 16}}}
                                                    text="Download"
                                                    iconProps={{ iconName: 'CloudDownload' }}
                                                    href={`https://image-host-processed-images.s3.amazonaws.com/${currentImage.path}`}
                                                    download
                                                />
                                            </div>
                                        </Stack>
                                    </Stack>

                                </Card.Section>
                            </Card>
                        </Stack>
                    </Modal>
                ) : null}
            </Fragment>
        )
    }
}