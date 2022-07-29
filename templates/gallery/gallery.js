const vscode = acquireVsCodeApi();
const container = document.getElementById("galleryObjects");
const updates = document.getElementById("update");
const verInf = document.getElementById("version-info");
const galleryObjs = document.getElementById("galleryObjects");

if (verInf.textContent.includes("Local")) {
  updates.classList.add("disabled");
  updates.innerText = "Local Gallery";
}

window.addEventListener("DOMContentLoaded", (event) => {
  vscode.postMessage({
    command: "getStyles",
  });
});

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "styles":
      styles = message.data;
      let i = 0;

      for (let img of galleryObjs.getElementsByClassName("image-button")) {
        if (styles[i].width) {
          img.style.width = styles[i].width;
        }
        if (styles[i].height) {
          img.style.width = styles[i].height;
        }
        if (styles[i].border) {
          img.style.border = styles[i].border;
        }
        i += 1;
      }
  }
});

container.addEventListener("click", (event) => {
  if (event.target.className === "image-button") {
    vscode.postMessage({
      command: "codeInsert",
      code: event.target.alt,
    });
  }
});

updates.addEventListener("click", (event) => {
  vscode.postMessage({
    command: "update",
  });
});
