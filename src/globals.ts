import * as vscode from "vscode";
import * as fs from "fs";

const logger = vscode.window.createOutputChannel("Plywood Gallery");

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
    logger.appendLine(handler(level, msg));
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

export const PROJECT_CONFIG_FILENAME = "html_configuration.yaml";
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
export function reformatObject<T>(conf: T): T {
  Object.keys(conf).forEach((key) => {
    let segs = key.split("_");
    segs = segs.map((name) => {
      if (name !== segs[0]) {
        name = name.replace(/./, (c) => c.toUpperCase());
      }
      return name;
    });
    const camelCaseKey = segs.join("");
    conf[camelCaseKey] = conf[key];
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
  js: vscode.Uri;
  html: vscode.Uri;
  css: vscode.Uri;
  icon: vscode.WebviewPanel["iconPath"];
};

/**
 * Used in webviews to load the html, js and css paths in one call.
 *
 * @param extensionUri
 * @param viewName
 * @returns WebviewResources
 */
export function getWebviewResource(
  extensionUri: vscode.Uri,
  viewName: string
): WebviewResources {
  return {
    css: vscode.Uri.joinPath(
      extensionUri,
      `templates/${viewName}/${viewName}.css`
    ),
    js: vscode.Uri.joinPath(extensionUri, `webview/${viewName}/${viewName}.js`),
    html: vscode.Uri.joinPath(
      extensionUri,
      `templates/${viewName}/${viewName}.html`
    ),
    icon: {
      dark: vscode.Uri.joinPath(
        extensionUri,
        `templates/${viewName}/${viewName}_darkicon.png`
      ),
      light: vscode.Uri.joinPath(
        extensionUri,
        `templates/${viewName}/${viewName}_lighticon.png`
      ),
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
  return phrase.replace(" ", "_").toLowerCase();
}
