import * as vscode from "vscode";
import {
  getWebviewResource,
  PROJECT_CONFIG_FILENAME,
  WebviewResources,
} from "./globals";
import {
  fetchLocalConfig,
  GalleryParams,
  HtmlConfig,
  localDirectoryOf,
} from "./origin";
import { TemplateEngine } from "./templateEngine";

type Project = {
  config: HtmlConfig;
  parameters: GalleryParams;
  previewImage: vscode.Uri;
};

async function getLocalProjects(extensionUri: vscode.Uri): Promise<Project[]> {
  const prjs = await vscode.workspace.fs.readDirectory(
    localDirectoryOf(extensionUri, "")
  );
  var projects: Project[] = [];
  for (let prj of prjs) {
    const config = await fetchLocalConfig(
      extensionUri,
      localDirectoryOf(extensionUri, prj[0], PROJECT_CONFIG_FILENAME)
    );
    if (!config) {
      continue;
    } else {
      const params: GalleryParams = JSON.parse(
        (
          await vscode.workspace.fs.readFile(
            localDirectoryOf(
              extensionUri,
              prj[0],
              config.gallaryParametersPath.split("/").pop()
            )
          )
        ).toString()
      );
      projects.push({
        config: config,
        parameters: params,
        previewImage: localDirectoryOf(
          extensionUri,
          prj[0],
          params[Object.keys(params)[0]][0].image_path.split("/").pop()
        ),
      });
    }
  }
  return projects;
}

function tabularize(project: Project) {
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
      galleryPreviewImagePath: project.previewImage,
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
      .map(tabularize)
      .join("\n");
    panel.iconPath = this.resource.icon;
    panel.webview.html = await engine.render({
      version: "0.0.1",
      hubItems: hubItemsStr,
    });
    panel.onDidDispose(() => {}, undefined, this.ctx.subscriptions);
  }
}
