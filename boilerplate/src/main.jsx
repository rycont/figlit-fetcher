import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

ReactDOM.render(
  <React.StrictMode>
    <RecoilRoot override>
      <RecoilNexus />
      <App />
    </RecoilRoot>
  </React.StrictMode>,
  document.getElementById("root")
);
