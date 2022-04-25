import * as vscode from "vscode";
import { getNonce, WebviewResources } from "./globals";

export class TemplateEngine {
  constructor(
    public readonly panel: vscode.WebviewPanel,
    public readonly resource: WebviewResources,
    public readonly extensionUri: vscode.Uri
  ) {}

  private resMap = {
    js: ` ${this.resource.name}.js`,
    css: ` ${this.resource.name}.css`,
  };
  private preamble = {
    cspSource: this.panel.webview.cspSource,
    [this.resMap.js]: this.panel.webview
      .asWebviewUri(this.resource.js)
      .toString(),
    [this.resMap.css]: this.panel.webview
      .asWebviewUri(this.resource.css)
      .toString(),
    nonce: getNonce(),
  };

  static trueRender(htmlDoc: string, globals: { [varname: string]: any }) {
    Object.keys(globals).forEach((varname) => {
      if (varname.startsWith(" ")) {
        htmlDoc = htmlDoc.replace(
          new RegExp(varname.trim(), "gi"),
          globals[varname]
        );
      } else {
        htmlDoc = htmlDoc.replace(
          new RegExp(`{{ ${varname} }}`, "gi"),
          globals[varname]
        );
      }
    });
    return htmlDoc;
  }

  /**
   * Render an HTML template file with the given variable parameters and the
   * required preamble.
   *
   * Semantics
   * 'varname' : {{ varname }}
   *  OR
   * ' varname' : varname
   *
   * The latter replaces any first occurence of the varname with unbound
   * squiggly braces. It must be fed into the globals object with a leading
   * space.
   */
  async render(globals: { [varname: string]: any }) {
    const a = this.resource.js.with({ scheme: "vscode-resource" })
    .toString();
    const b = this.panel.webview
    .asWebviewUri(this.resource.js)
    .toString();

    return TemplateEngine.trueRender(
      TemplateEngine.trueRender(
        (await vscode.workspace.fs.readFile(this.resource.html)).toString(),
        this.preamble
      ),
      globals
    );
  }
}
