import * as vscode from "vscode";
import {
  getWebviewResource,
  WebviewResources,
} from "./globals";
import { getLocalProjects, Project } from "./origin";
import { TemplateEngine } from "./templateEngine";


function tabularize(project: Project, webview: vscode.Webview) {
  return TemplateEngine.trueRender(
    `
  <tr><td>
    <div class="galleryCard">
      <img class="galleryPreviewImage" alt="thumbnail" src="{{ galleryPreviewImagePath }}">
    </div>
  </td>
  <td>
    <div class="galleryCard">
      <span class="galleryTitle">{{ galleryTitle }}</span><br>
      <span class="galleryDesc">{{ galleryDesc }}</span>
      <ul>{{ chapters }}</ul>
    </div>
  </td></tr>
  `,
    {
      galleryPreviewImagePath: webview.asWebviewUri(project.previewImage),
      galleryTitle: project.config.projectName,
      galleryDesc: project.config.description,
      chapters: Object.keys(project.parameters)
        .map((chapter) => `<li>${chapter}</li>`)
        .join("\n"),
    }
  );
}

export class Hub {
  constructor(public readonly ctx: vscode.ExtensionContext) {}

  private resource: WebviewResources = getWebviewResource(
    this.ctx.extensionUri,
    "hub"
  );

  async show() {
    let panel = vscode.window.createWebviewPanel(
      "plywood-gallery",
      "Plywood Gallery Hub",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
      }
    );
    let engine = new TemplateEngine(
      panel,
      this.resource,
      this.ctx.extensionUri
    );
    let hubItemsStr = (await getLocalProjects(this.ctx.extensionUri))
      .map(p => tabularize(p, panel.webview))
      .join("\n");
    panel.iconPath = this.resource.icon;
    panel.webview.html = await engine.render({
      version: "0.0.1",
      hubItems: hubItemsStr,
    });
    panel.onDidDispose(() => {}, undefined, this.ctx.subscriptions);
  }
}
