const vscode = acquireVsCodeApi();
const galleryObjsContainer = document.getElementById("galleryObjects");
const updates = document.getElementById("update");
const verInf = document.getElementById("version-info");
const galleryObjs = document.getElementById("galleryObjects");

if (verInf.textContent.includes("Local")) {
  updates.classList.add("disabled");
  updates.innerText = "Local Gallery";
}

window.addEventListener("DOMContentLoaded", (event) => {
  vscode.postMessage({
    command: "loaded",
  });
});

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "fill":
      objects = message.data;
      galleryObjsContainer.innerHTML = "";
      for (let title of Object.keys(objects)) {
        const O_TITLE = document.createElement("h2");
        O_TITLE.textContent = title;
        galleryObjsContainer.append(O_TITLE);

        for (let imgUrl of Object.keys(objects[title])) {
          const O_IMAGE = document.createElement("img");
          O_IMAGE.classList.add("image-button");
          O_IMAGE.setAttribute("alt", objects[title][imgUrl].code);
          O_IMAGE.setAttribute("src", imgUrl);
          const styles = objects[title][imgUrl].css;
          if (styles.width) {
            O_IMAGE.style.width = styles.width;
          }
          if (styles.height) {
            O_IMAGE.style.width = styles.height;
          }
          galleryObjsContainer.append(O_IMAGE);
        }
      }
  }
});

galleryObjsContainer.addEventListener("click", (event) => {
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
