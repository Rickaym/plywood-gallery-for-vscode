import * as vscode from "vscode";
import * as fs from "fs";
import { TextEncoder } from "util";
import Axios, { ResponseType } from "axios";

export const LOGGER = vscode.window.createOutputChannel("Plywood Gallery");

type FormatHandlerFn = (level: string, msg: string) => string;

export class Log {
  static defaultFormatHandler(level: string, msg: string) {
    const date = new Date();
    return `[${date.toLocaleDateString()} ${date.getHours()}:${date.getMinutes()}] ${level.toUpperCase()}: ${msg}`;
  }

  static logs(
    level: string,
    msg: string,
    handler: FormatHandlerFn = Log.defaultFormatHandler
  ) {
    LOGGER.appendLine(handler(level, msg));
    return msg;
  }

  static info(msg: string) {
    return Log.logs("info", msg);
  }

  static warn(msg: string) {
    return Log.logs("warn", msg);
  }

  static error(msg: string) {
    return Log.logs("error", msg);
  }
}

export const PROJECT_CONFIG_FILENAME = "gallery_config.yaml";
export const ALLOWED_ASSET_FILE_EXTENSIONS = [".png", ".jpeg", ".jpg"];

export function hasValidFileExtension(filename: string) {
  return ALLOWED_ASSET_FILE_EXTENSIONS.some((extension) =>
    filename.endsWith(extension)
  );
}

/**
 * Reformat all object keys to be in camelCase, values and
 * all other remains untouched.
 */
export function reformatObject<T>(conf: any): T {
  Object.keys(conf).forEach((key) => {
    let segs = key.split("_");
    segs = segs.map((name) => {
      if (name !== segs[0]) {
        name = name.replace(/./, (c) => c.toUpperCase());
      }
      return name;
    });
    conf[segs.join("")] = conf[key];
  });
  return conf;
}

/**
 * Provide a nonce for inline scripts inside webviews, this is necessary
 * for script execution.
 * @returns nonce
 */
export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export type WebviewResources = {
  name: string;
  js: vscode.Uri;
  html: vscode.Uri;
  css: vscode.Uri;
  icon: vscode.WebviewPanel["iconPath"];
};

/**
 * Returns the full file Uri of the webview resource.
 *
 * @param extensionUri
 * @param viewName
 * @param fileType
 * @param fileName
 * @returns
 */
export function getWebviewResFp(
  extensionUri: vscode.Uri,
  viewName: string,
  fileType: string,
  fileName?: string
) {
  if (!fileName) {
    fileName = viewName;
  }
  return vscode.Uri.joinPath(
    extensionUri,
    `templates/${viewName}/${fileName}.${fileType}`
  );
}

export function getWebviewResource(
  extensionUri: vscode.Uri,
  viewName: string
): WebviewResources {
  return {
    name: viewName,
    css: getWebviewResFp(extensionUri, viewName, "css"),
    js: getWebviewResFp(extensionUri, viewName, "js"),
    html: getWebviewResFp(extensionUri, viewName, "html"),
    icon: {
      dark: getWebviewResFp(extensionUri, `${viewName}_darkicon`, "png"),
      light: getWebviewResFp(extensionUri, `${viewName}_lighticon`, "png"),
    },
  };
}

/**
 * Check whether if the path leads to an existent object as well as
 * of the type specified.
 *
 * @param fsPath
 * @param isFile
 * @returns
 */
export function isValidPath(fsPath: string, isFile: boolean) {
  if (!fs.existsSync(fsPath)) {
    return false;
  } else if (isFile) {
    if (fs.statSync(fsPath).isFile()) {
      return true;
    } else {
      return false;
    }
  } else {
    if (fs.statSync(fsPath).isDirectory()) {
      return true;
    } else {
      return false;
    }
  }
}

/**
 * Modify unfriendly phrases to snake case.
 *
 * @param phrase
 * @returns
 */
export function canonical(phrase: string) {
  return phrase.replace(/ |-/g, "_").toLowerCase();
}

export var PACKAGE_JSON: undefined | any = undefined;

export async function loadPackageJson(extensionUri: vscode.Uri) {
  return vscode.workspace.fs
    .readFile(vscode.Uri.joinPath(extensionUri, "package.json"))
    .then((val) => {
      PACKAGE_JSON = JSON.parse(val.toString());
    });
}

export async function makeShellDirectories(
  extensionUri: vscode.Uri,
  dirNames: string[]
) {
  for (let name in dirNames) {
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.joinPath(extensionUri, name)
    );
  }
}

/**
 * Returns a github repository Url as a githubusercontent url
 * and resolves the intended branch of the URL.
 *
 * @param urlInput
 * @returns
 */
export function prepareRepoUrl(urlInput: string) {
  let branch = "main";
  let url = urlInput.trim();

  if (urlInput.includes(":") && urlInput.split(":").length - 1 === 2) {
    const segs = urlInput.split(":");
    if (segs[1]) {
      branch = segs[0];
      url = segs[1];
    }
  }

  if (url.endsWith("/")) {
    url = url.slice(0, url.length - 1);
  }
  return `${url}/${branch}`.replace("github.com", "raw.githubusercontent.com");
}

/**
 * Presents the user an option to open or cancel a gallery
 * with the provided identifier alongside a message.
 *
 * @param msg
 * @param identifier
 */
export function letOpenGallery(msg: string, identifier: string) {
  vscode.window.showInformationMessage(msg, "Open", "Cancel").then((v) => {
    if (v === "Open") {
      vscode.commands.executeCommand("plywood-gallery.Open", identifier);
    }
  });
}

export function asUint8Array(payload: string) {
  return new TextEncoder().encode(payload);
}

export async function getContent(
  url: string,
  contentName: string,
  responseType: ResponseType = "text"
) {
  return Axios.get(url, { responseType: responseType }).catch((e: any) => {
    if (e.response) {
      vscode.window.showErrorMessage(
        Log.error(
          `${e.response.status}: ${e.response.statusText}.\nCouldn't fetch ${contentName}..`
        )
      );
    } else {
      throw e;
    }
    return;
  });
}
