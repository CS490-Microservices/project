import React, { Component } from "react";
import "./NavBar.css";

export default class NavBar extends Component {
  constructor(props){
    super(props)
  }
  
  render() {
    return (
      <div className="topnav">
        <a id="left" href="/">
          Home
        </a>
      </div>
    );
  }
}