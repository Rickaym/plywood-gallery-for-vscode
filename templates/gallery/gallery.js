const vscode = acquireVsCodeApi();
const container = document.getElementById("galleryObjects");
const updates = document.getElementById("update");
const verInf = document.getElementById("version-info");
const galleryObjs = document.getElementById("galleryObjects");

if (verInf.textContent.includes("Local")) {
  updates.classList.add("disabled");
  updates.innerText = "Local Gallery";
}

window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
      case 'styles':
        let i = 0;
        for (let img of galleryObjs.getElementsByClassName("image-button")) {
          if (message.data[i].width) {
            img.style.width = message.data[i].width;
          }
          if (message.data[i].height) {
            img.style.width = message.data[i].height;
          }
          i += 1;
        }
  }
});

container.addEventListener("click", (event) => {
  if (event.target.className === "image-button") {
    vscode.postMessage({
      command: "code-insert",
      code: event.target.alt,
    });
  }
});

updates.addEventListener("click", (event) => {
  vscode.postMessage({
    command: "update",
  });
});