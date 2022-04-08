import * as vscode from "vscode";

type Global = { [varname: string]: any };

export class TemplateEngine {
  fpUri: vscode.Uri;

  constructor(
    public readonly fp: string,
    public readonly extensionUri: vscode.Uri
  ) {
    this.fp = fp;
    this.fpUri = vscode.Uri.joinPath(extensionUri, fp);
  }

  /**
   * Render an HTML template file with the given variable parameters.
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
  async render(globals: Global) {
    let htmlDoc = (await vscode.workspace.fs.readFile(this.fpUri)).toString();
    Object.keys(globals).forEach((varname) => {
        if (varname.startsWith(" ")) {
            htmlDoc = htmlDoc.replace(varname.trim(), globals[varname]);
        } else {
            htmlDoc = htmlDoc.replace(`{{ ${varname} }}`, globals[varname]);
        }
    });
    return htmlDoc;
  }
}
