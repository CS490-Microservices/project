import React, { Component, Fragment } from "react";
import { Card, CardItem } from "@uifabric/react-cards";
import { Spinner, SpinnerSize } from "office-ui-fabric-react/lib/Spinner";
import { Overlay, Modal, DefaultButton } from "office-ui-fabric-react";
import { TextField } from "office-ui-fabric-react/lib/TextField";
import { PrimaryButton, Stack } from "office-ui-fabric-react";
import Cookies from "universal-cookie";
import "./Home.css";

const cookies = new Cookies();

export default class Home extends Component {
  constructor(props) {
    super(props);

    this.state = {
      images: [],
      overlayHidden: true,
      uploading: false,
      currentImage: null,
      showLoginModal: false,
      loggedIn: cookies.get("token") !== undefined,
    };

    this.getAllImages = this.getAllImages.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.onDragEnter = this.onDragEnter.bind(this);
    this.onDragLeave = this.onDragLeave.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.getBase64 = this.getBase64.bind(this);
    this.login = this.login.bind(this);
    this.signUp = this.signUp.bind(this);

    window.addEventListener(
      "dragover",
      function (e) {
        e.preventDefault();
      },
      false
    );
    window.addEventListener(
      "drop",
      function (e) {
        e.preventDefault();
      },
      false
    );
  }

  componentDidMount() {
    this.getAllImages();
  }

  login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (username.trim() === "" || password.trim() === "") {
      return;
    }

    fetch(
      `https://pwrn016lf5.execute-api.us-east-1.amazonaws.com/default/login?username=${username}&password=${password}`,
      { method: "GET" }
    )
      .then((data) => data.json())
      .then((data) => {
        if (data === "error") {
          console.log("err");
        } else {
          cookies.set("token", data.token);
          this.setState({ loggedIn: true, showLoginModal: false });
        }
      });
  }

  signUp() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (username.trim() === "" || password.trim() === "") {
      return;
    }

    fetch(
      `https://pwrn016lf5.execute-api.us-east-1.amazonaws.com/default/createUser?user=${username}&password=${password}`,
      { method: "GET" }
    ).then(response => {
        if(response.status === 200) {
            this.login();
        }
    });
  }

  getAllImages() {
    fetch(
      "https://pwrn016lf5.execute-api.us-east-1.amazonaws.com/default/getImage"
    )
      .then((data) => data.json())
      .then((data) => {
        this.setState({ images: data });
      });
  }

  uploadImage(data, type) {
    const { loggedIn } = this.state;

    if (!loggedIn) {
      return;
    }

    return new Promise((resolve, _) => {
      fetch(
        `https://pwrn016lf5.execute-api.us-east-1.amazonaws.com/default/uploadImage`,
        {
          method: "POST",
          headers: {
            Authorization: cookies.get("token"),
          },
          body: JSON.stringify({
            token: cookies.get("token"),
            content: data,
            type,
          }),
        }
      ).then((_) => {
        resolve();
      });
    });
  }

  onDragEnter(e) {
    e.stopPropagation();
    e.preventDefault();
    const { loggedIn } = this.state;

    if (!loggedIn) {
      return;
    }
    this.setState({ overlayHidden: false });
  }

  onDragLeave(e) {
    e.stopPropagation();
    e.preventDefault();
    const { loggedIn } = this.state;

    if (!loggedIn) {
      return;
    }
    if (e.pageX === 0 || e.pageY === 0) {
      this.setState({ overlayHidden: true });
    }
  }

  getBase64(file) {
    return new Promise((resolve, _) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
    });
  }

  async onDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const { loggedIn } = this.state;

    if (!loggedIn) {
      return;
    }

    this.setState({ uploading: true });
    const uploads = [];
    for (const file of e.dataTransfer.files) {
      if (file.type === "image/png" || file.type === "image/jpeg") {
        const base64 = await this.getBase64(file);
        uploads.push(this.uploadImage(base64, file.type));
      }
    }

    Promise.all(uploads).then((_) => {
      this.setState({ uploading: false, overlayHidden: true });
      setTimeout(() => {
        this.getAllImages();
      }, 2000);
    });
  }

  render() {
    const {
      images,
      overlayHidden,
      uploading,
      currentImage,
      showLoginModal,
      loggedIn,
    } = this.state;

    return (
      <Fragment>
        <div className="topnav">
          <a id="left">Home</a>
          {loggedIn ? (
            <a
              id="right"
              onClick={(_) => {
                cookies.remove("token");
                this.setState({ loggedIn: false });
              }}
            >
              Log Out
            </a>
          ) : (
            <a
              id="right"
              onClick={(_) => {
                this.setState({ showLoginModal: true });
              }}
            >
              Login
            </a>
          )}
        </div>
        <div
          id="drop"
          onDragEnter={this.onDragEnter}
          onDragLeave={this.onDragLeave}
          onDrop={this.onDrop}
        >
          <h1 style={{marginLeft: 16, marginTop: 16}}>Images</h1>
          <Stack
            horizontal
            verticalFill
            wrap
            horizontalAlign="center"
            tokens={{ childrenGap: 30 }}
          >
            {images.map((image) => {
              const imageSrc = `https://image-host-processed-images.s3.amazonaws.com/${image.path}`;
              return (
                <Card
                  horizontal
                  horizontalAlign="center"
                  key={image.path}
                  styles={{ root: { backgroundColor: "white" } }}
                >
                  <CardItem>
                    <div
                      className="image-container"
                      onClick={() => {
                        this.setState({ currentImage: image });
                      }}
                    >
                      <img className="image" src={imageSrc} alt="view" />
                    </div>
                  </CardItem>
                </Card>
              );
            })}
          </Stack>
          {overlayHidden ? null : (
            <Overlay isDarkThemed={true}>
              <div className="overlay">
                <div className="overlay-content">
                  {uploading ? (
                    <Spinner label="Uploading..." size={SpinnerSize.large} />
                  ) : (
                    <h1>Drop Files To Upload</h1>
                  )}
                </div>
              </div>
            </Overlay>
          )}
        </div>
        {currentImage !== null ? (
          <Modal
            isOpen={currentImage !== null}
            isBlocking={false}
            onDismiss={() => {
              this.setState({ currentImage: null });
            }}
            styles={{ main: { borderRadius: 5 } }}
          >
            <Stack
              horizontal
              horizontalAlign="center"
              tokens={{ childrenGap: 16 }}
            >
              <Card horizontal styles={{ root: { maxWidth: "900px" } }}>
                <Card.Section>
                  <Stack horizontal>
                    <div style={{ margin: "16px" }}>
                      <Card horizontal>
                        <img
                          src={`https://image-host-processed-images.s3.amazonaws.com/${currentImage.path}`}
                          alt="view"
                        />
                      </Card>
                    </div>
                    <Stack>
                      <div style={{ width: 400 }}>
                        <p>Uploaded by: {currentImage.user}</p>
                        <p>
                          Tag:{" "}
                          {currentImage.tag === null
                            ? "None"
                            : currentImage.tag}
                        </p>
                        <DefaultButton
                          styles={{
                            root: { position: "absolute", bottom: 16 },
                          }}
                          text="Download"
                          iconProps={{ iconName: "CloudDownload" }}
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
        <Modal
          isOpen={showLoginModal}
          isBlocking={false}
          onDismiss={(_) => {
            this.setState({ showLoginModal: false });
          }}
        >
          <div
            style={{
              alignContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Card
              aria-label="Basic horizontal card"
              horizontal
              style={{
                margin: "0 auto",
                padding: "1rem",
                backgroundColor: "white",
              }}
            >
              <Stack
                tokens={{ childrenGap: 5 }}
                styles={{
                  root: {
                    width: "100%",
                  },
                }}
              >
                <h3 style={{ paddingLeft: "1rem" }}>Sign In</h3>

                <Stack.Item align="center">
                  <TextField
                    id="username"
                    label="Username"
                    placeholder="Username"
                  />
                </Stack.Item>
                <Stack.Item align="center">
                  <TextField
                    label="Password"
                    id="password"
                    type="password"
                    placeholder="Password"
                  />
                  <br />
                </Stack.Item>
                <Stack
                  horizontal
                  horizontalAlign="center"
                  tokens={{ childrenGap: 10 }}
                >
                  <PrimaryButton onClick={this.login}>Login</PrimaryButton>
                  <PrimaryButton onClick={this.signUp}>Sign Up</PrimaryButton>
                </Stack>
                <br />
                <br />
              </Stack>
            </Card>
          </div>
        </Modal>
      </Fragment>
    );
  }
}
