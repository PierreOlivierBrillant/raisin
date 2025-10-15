import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { generateStandardizedZip } from "../../services/generateStandardizedZip";
import type { StudentFolder } from "../../types";

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

class FakeFile extends Blob implements File {
  readonly lastModified: number;
  readonly name: string;
  readonly webkitRelativePath = "";

  constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
    super(chunks, options);
    this.name = name;
    this.lastModified = options?.lastModified ?? Date.now();
  }
}

describe("generateStandardizedZip", () => {
  it("copie un projet issu d'un zip imbriqué en conservant son contenu", async () => {
    const innerZip = new JSZip();
    innerZip.file("Intra/settings.gradle", "rootProject.name = 'demo'\n");
    innerZip.file("Intra/build.gradle", "plugins { id 'java' }\n");

    const nestedBuffer = await innerZip.generateAsync({ type: "arraybuffer" });

    const rootZip = new JSZip();
    rootZip.file("StudentA.zip", nestedBuffer, { binary: true });

    const rootBuffer = await rootZip.generateAsync({ type: "arraybuffer" });
    const zipFile = new FakeFile([rootBuffer], "students.zip", {
      type: "application/zip",
    });

    const results: StudentFolder[] = [
      {
        name: "StudentA.zip",
        overallScore: 100,
        matches: [],
        projects: [
          {
            projectRootPath: "StudentA.zip/Intra",
            score: 100,
            matchedNodesCount: 3,
            totalTemplateNodes: 3,
            templateMatches: [],
            suggestedNewPath: "StudentA_Intra",
            newPath: "StudentA_Intra",
          },
        ],
      },
    ];

    const blob = await generateStandardizedZip(zipFile, results);
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());

    const files = Object.values(outputZip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name.replace(/\\+/g, "/"));

    expect(files).toContain("StudentA_Intra/settings.gradle");
    expect(files).toContain("StudentA_Intra/build.gradle");
  });

  it("conserve les éléments au même niveau qu'un fichier solution .NET", async () => {
    const rootZip = new JSZip();
    rootZip.file("StudentA/Intra/SignalR.sln", "");
    rootZip.file("StudentA/Intra/Program.cs", "");
    rootZip.file("StudentA/Intra/SignalR.csproj", "");
    rootZip.file("StudentA/Intra/SignalR/Controllers/HomeController.cs", "");

    const rootBuffer = await rootZip.generateAsync({ type: "arraybuffer" });
    const zipFile = new FakeFile([rootBuffer], "students.zip", {
      type: "application/zip",
    });

    const results: StudentFolder[] = [
      {
        name: "StudentA",
        overallScore: 90,
        matches: [],
        projects: [
          {
            projectRootPath: "StudentA/Intra",
            score: 90,
            matchedNodesCount: 2,
            totalTemplateNodes: 4,
            templateMatches: [
              {
                templateNodeId: "solution",
                foundPath: "StudentA/Intra/SignalR.sln",
                score: 100,
                status: "found",
              },
              {
                templateNodeId: "projectDir",
                foundPath: "StudentA/Intra/SignalR",
                score: 100,
                status: "found",
              },
              {
                templateNodeId: "csproj",
                foundPath: "",
                score: 0,
                status: "missing",
              },
              {
                templateNodeId: "program",
                foundPath: "",
                score: 0,
                status: "missing",
              },
            ],
            suggestedNewPath: "StudentA_Intra",
            newPath: "StudentA_Intra",
          },
        ],
      },
    ];

    const blob = await generateStandardizedZip(zipFile, results);
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());

    const files = Object.values(outputZip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name.replace(/\+/g, "/"));

    expect(files).toContain("StudentA_Intra/SignalR.sln");
    expect(files).toContain("StudentA_Intra/Program.cs");
    expect(files).toContain("StudentA_Intra/SignalR.csproj");
    expect(files).toContain(
      "StudentA_Intra/SignalR/Controllers/HomeController.cs"
    );
  });

  it("inclut tout le dossier même si seul le fichier .sln correspond au template", async () => {
    const rootZip = new JSZip();
    rootZip.file("StudentA/Intra/SignalR.sln", "");
    rootZip.file("StudentA/Intra/Program.cs", "");
    rootZip.file("StudentA/Intra/SignalR/Controllers/HomeController.cs", "");

    const rootBuffer = await rootZip.generateAsync({ type: "arraybuffer" });
    const zipFile = new FakeFile([rootBuffer], "students.zip", {
      type: "application/zip",
    });

    const results: StudentFolder[] = [
      {
        name: "StudentA",
        overallScore: 100,
        matches: [],
        projects: [
          {
            projectRootPath: "StudentA/Intra",
            score: 100,
            matchedNodesCount: 1,
            totalTemplateNodes: 1,
            templateMatches: [
              {
                templateNodeId: "solution",
                foundPath: "StudentA/Intra/SignalR.sln",
                score: 100,
                status: "found",
              },
            ],
            suggestedNewPath: "StudentA_Intra",
            newPath: "StudentA_Intra",
          },
        ],
      },
    ];

    const blob = await generateStandardizedZip(zipFile, results);
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());

    const files = Object.values(outputZip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name.replace(/\+/g, "/"));

    expect(files).toContain("StudentA_Intra/SignalR.sln");
    expect(files).toContain("StudentA_Intra/Program.cs");
    expect(files).toContain(
      "StudentA_Intra/SignalR/Controllers/HomeController.cs"
    );
  });
});
