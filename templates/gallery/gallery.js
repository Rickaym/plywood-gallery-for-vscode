const vscode = acquireVsCodeApi();
const container = document.getElementById("galleryObjects");
const updates = document.getElementById("update");
const verInf = document.getElementById("version-info");

if (verInf.textContent.includes("Local")) {
  updates.classList.add("disabled");
  updates.innerText = "Local Gallery";
}

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