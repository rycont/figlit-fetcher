import React from "react";
import ReactDOM from "react-dom";
import { RecoilRoot } from "recoil";
import RecoilNexus from "recoil-nexus"

import App from "./App";
import "./style.css";

ReactDOM.render(
  <React.StrictMode>
    <RecoilRoot>
      <RecoilNexus />
      <App />
    </RecoilRoot>
  </React.StrictMode>,
  document.getElementById("root")
);
