import * as vscode from "vscode";
import { getNonce, WebviewResources } from "./globals";

export class TemplateEngine {
  constructor(
    public readonly panel: vscode.WebviewPanel,
    public readonly resource: WebviewResources,
    public readonly extensionUri: vscode.Uri
  ) {}

  private preamble = {
    cspSource: this.panel.webview.cspSource,
    " hub.js": this.panel.webview.asWebviewUri(this.resource.js).toString(),
    " hub.css": this.panel.webview.asWebviewUri(this.resource.css).toString(),
    nonce: getNonce(),
  };

  static trueRender(htmlDoc: string, globals: { [varname: string]: any }) {
    Object.keys(globals).forEach((varname) => {
      if (varname.startsWith(" ")) {
        htmlDoc = htmlDoc.replace(varname.trim(), globals[varname]);
      } else {
        htmlDoc = htmlDoc.replace(`{{ ${varname} }}`, globals[varname]);
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
    return TemplateEngine.trueRender(
      TemplateEngine.trueRender(
        (await vscode.workspace.fs.readFile(this.resource.html)).toString(),
        this.preamble
      ),
      globals
    );
  }
}
