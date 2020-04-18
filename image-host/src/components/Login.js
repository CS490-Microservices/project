import React, { Component } from "react";
import { Card, CardItem } from "@uifabric/react-cards";
import { TextField } from "office-ui-fabric-react/lib/TextField";
import { PrimaryButton, Stack } from "office-ui-fabric-react";

export default class Login extends Component {
    constructor(props) {
        super(props)
    }

    render() {
        return (
            <div
        style={{
          alignContent: "center",
          width: "100%",
          height: "100%",
          marginTop: "2rem"
        }}
      >
        <Card
          aria-label="Basic horizontal card"
          horizontal
          style={{ margin: "0 auto", padding: "1rem", backgroundColor: 'white' }}
        >
          <Stack
            tokens={{ childrenGap: 5 }}
            styles={{
              root: {
                width: "100%"
              }
            }}
          >
            <h4 style={{ paddingLeft: "1rem" }}>Sign In</h4>

            <Stack.Item align="center">
              <TextField label="Username" placeholder="Username" />
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
              <PrimaryButton>
                Login
              </PrimaryButton>
              <PrimaryButton href="/register">Sign-Up</PrimaryButton>
            </Stack>
            <br />
            <br />
          </Stack>
        </Card>
      </div>
        );
    }
}