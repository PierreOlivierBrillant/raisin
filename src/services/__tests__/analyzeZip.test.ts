import { describe, expect, it } from "vitest";
import { analyzeZipWithReader } from "../../services/analyzeZip";
import type { HierarchyTemplate } from "../../types";
import type { IZipEntryMeta, IZipReader } from "../../types/zip";

function createMockReader(entries: IZipEntryMeta[]): IZipReader {
  return {
    kind: "mock",
    capabilities: { expandNestedZipsClientSide: true },
    async listEntries() {
      return entries;
    },
  };
}

const gradleTemplate: HierarchyTemplate = {
  id: "gradle-test",
  name: "Gradle",
  description: "Template Gradle minimal",
  rootNodes: ["root"],
  nodes: {
    root: {
      id: "root",
      name: "Racine",
      type: "directory",
      path: "Racine",
      children: ["settings", "build", "src"],
    },
    settings: {
      id: "settings",
      name: "settings.gradle",
      type: "file",
      path: "Racine/settings.gradle*",
      parent: "root",
      children: [],
    },
    build: {
      id: "build",
      name: "build.gradle",
      type: "file",
      path: "Racine/build.gradle*",
      parent: "root",
      children: [],
    },
    src: {
      id: "src",
      name: "src",
      type: "directory",
      path: "Racine/src",
      parent: "root",
      children: ["srcMain"],
    },
    srcMain: {
      id: "srcMain",
      name: "main",
      type: "directory",
      path: "Racine/src/main",
      parent: "src",
      children: ["srcMainAny"],
    },
    srcMainAny: {
      id: "srcMainAny",
      name: "*",
      type: "directory",
      path: "Racine/src/main/*",
      parent: "srcMain",
      children: [],
    },
  },
};

const dotnetTemplate: HierarchyTemplate = {
  id: "dotnet-test",
  name: ".NET",
  description: "Template .NET minimal",
  rootNodes: ["root"],
  nodes: {
    root: {
      id: "root",
      name: "Racine",
      type: "directory",
      path: "Racine",
      children: ["solution", "projectDir"],
    },
    solution: {
      id: "solution",
      name: "*.sln",
      type: "file",
      path: "Racine/*.sln",
      parent: "root",
      children: [],
    },
    projectDir: {
      id: "projectDir",
      name: "*",
      type: "directory",
      path: "Racine/*",
      parent: "root",
      children: ["csproj", "program"],
    },
    csproj: {
      id: "csproj",
      name: "*.csproj",
      type: "file",
      path: "Racine/*/*.csproj",
      parent: "projectDir",
      children: [],
    },
    program: {
      id: "program",
      name: "Program.cs",
      type: "file",
      path: "Racine/*/Program.cs",
      parent: "projectDir",
      children: [],
    },
  },
};

describe("analyzeZipWithReader", () => {
  it("détecte un projet Gradle à la racine même sans dossier étudiant explicite", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "settings.gradle", isDir: false },
      { path: "build.gradle", isDir: false },
      { path: "gradle.properties", isDir: false },
      { path: "src", isDir: true },
      { path: "src/main", isDir: true },
      { path: "src/main/java", isDir: true },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: gradleTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const rootFolder = results.find((folder) => folder.name === "");
    expect(rootFolder).toBeDefined();
    expect(rootFolder!.projects).not.toHaveLength(0);
    const project = rootFolder!.projects[0];
    expect(project.score).toBe(100);
    expect(
      project.templateMatches.every((match) => match.status === "found")
    ).toBe(true);
  });

  it("détecte un projet .NET Core avec un dossier et des fichiers imbriqués", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "StudentA", isDir: true },
      { path: "StudentA/MyApp", isDir: true },
      { path: "StudentA/MyApp.sln", isDir: false },
      { path: "StudentA/MyApp/MyApp.csproj", isDir: false },
      { path: "StudentA/MyApp/Program.cs", isDir: false },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: dotnetTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const studentFolder = results.find((folder) => folder.name === "StudentA");
    expect(studentFolder).toBeDefined();
    expect(studentFolder!.projects).not.toHaveLength(0);
    const project = studentFolder!.projects[0];
    expect(project.projectRootPath).toBe("StudentA");
    expect(project.score).toBe(100);
    expect(project.templateMatches.every((m) => m.status === "found")).toBe(
      true
    );
  });

  it("ignore les correspondances partielles si la hiérarchie attendue n'est pas respectée", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "StudentA", isDir: true },
      { path: "StudentA/SignalR.sln", isDir: false },
      { path: "StudentA/SignalR.csproj", isDir: false },
      { path: "StudentA/Program.cs", isDir: false },
      { path: "StudentA/SignalR", isDir: true },
      { path: "StudentA/SignalR/Controllers", isDir: true },
    ];

    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: dotnetTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const studentFolder = results.find((folder) => folder.name === "StudentA");
    expect(studentFolder).toBeDefined();
    const project = studentFolder!.projects[0];
    expect(project.projectRootPath).toBe("StudentA");

    const matches = Object.fromEntries(
      project.templateMatches.map((m) => [m.templateNodeId, m])
    );

    expect(matches.solution?.score).toBe(100);
    expect(matches.projectDir?.score).toBe(100);
    expect(matches.csproj?.score).toBe(0);
    expect(matches.program?.score).toBe(0);
  });

  it("ignore les fichiers au niveau racine du dossier étudiant", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "StudentA", isDir: true },
      { path: "StudentA/SignalR", isDir: true },
      { path: "StudentA/SignalR/SignalR.sln", isDir: false },
      { path: "StudentA/SignalR/Program.cs", isDir: false },
      { path: "notes.txt", isDir: false },
    ];

    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: dotnetTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const folderNames = results.map((folder) => folder.name);
    expect(folderNames).toContain("StudentA");
    expect(folderNames).not.toContain("");
  });

  it("applique studentRootPath pour scanner uniquement le dossier des étudiants", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "archive/meta.txt", isDir: false },
      { path: "archive/students", isDir: true },
      { path: "archive/students/StudentA", isDir: true },
      { path: "archive/students/StudentA/MyApp", isDir: true },
      { path: "archive/students/StudentA/MyApp.sln", isDir: false },
      {
        path: "archive/students/StudentA/MyApp/MyApp.csproj",
        isDir: false,
      },
      {
        path: "archive/students/StudentA/MyApp/Program.cs",
        isDir: false,
      },
      { path: "archive/students/StudentB", isDir: true },
      {
        path: "archive/students/StudentB/Service",
        isDir: true,
      },
      { path: "archive/students/StudentB/Service.sln", isDir: false },
      {
        path: "archive/students/StudentB/Service/Service.csproj",
        isDir: false,
      },
      {
        path: "archive/students/StudentB/Service/Program.cs",
        isDir: false,
      },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: dotnetTemplate,
      reader,
      studentRootPath: "archive/students",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const studentNames = new Set(results.map((folder) => folder.name));
    expect(studentNames.has("StudentA")).toBe(true);
    expect(studentNames.has("StudentB")).toBe(true);
    for (const folder of results.filter((f) => f.name.startsWith("Student"))) {
      expect(folder.projects).not.toHaveLength(0);
      expect(folder.projects[0].score).toBe(100);
    }
  });

  it("retombe sur la racine lorsque studentRootPath est invalide", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "StudentOnly", isDir: true },
      { path: "StudentOnly/settings.gradle", isDir: false },
      { path: "StudentOnly/build.gradle", isDir: false },
      { path: "StudentOnly/gradle.properties", isDir: false },
      { path: "StudentOnly/src", isDir: true },
      { path: "StudentOnly/src/main", isDir: true },
      { path: "StudentOnly/src/main/java", isDir: true },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: gradleTemplate,
      reader,
      studentRootPath: "path/does/not/exist",
      projectsPerStudent: 1,
      similarityThreshold: 70,
    });

    const fallbackFolder = results.find((folder) =>
      ["", "StudentOnly"].includes(folder.name)
    );
    expect(fallbackFolder).toBeDefined();
    expect(fallbackFolder!.projects).not.toHaveLength(0);
    expect(fallbackFolder!.projects[0].score).toBe(100);
  });

  it("détecte un projet Gradle dans un zip étudiant contenant un dossier Intra", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "etudianta.zip", isDir: true },
      { path: "etudianta.zip/Intra", isDir: true },
      { path: "etudianta.zip/Intra/settings.gradle", isDir: false },
      { path: "etudianta.zip/Intra/build.gradle", isDir: false },
      { path: "etudianta.zip/Intra/gradle.properties", isDir: false },
      { path: "etudianta.zip/Intra/src", isDir: true },
      { path: "etudianta.zip/Intra/src/main", isDir: true },
      { path: "etudianta.zip/Intra/src/main/java", isDir: true },
      { path: "etudiantb.zip", isDir: true },
      { path: "etudiantb.zip/Intra", isDir: true },
      { path: "etudiantb.zip/Intra/settings.gradle", isDir: false },
      { path: "etudiantb.zip/Intra/build.gradle", isDir: false },
      { path: "etudiantb.zip/Intra/gradle.properties", isDir: false },
      { path: "etudiantb.zip/Intra/src", isDir: true },
      { path: "etudiantb.zip/Intra/src/main", isDir: true },
      { path: "etudiantb.zip/Intra/src/main/java", isDir: true },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: gradleTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const folderNames = new Set(results.map((folder) => folder.name));
    expect(folderNames.has("etudianta.zip")).toBe(true);
    expect(folderNames.has("etudiantb.zip")).toBe(true);

    const folderA = results.find((folder) => folder.name === "etudianta.zip");
    const folderB = results.find((folder) => folder.name === "etudiantb.zip");
    expect(folderA).toBeDefined();
    expect(folderB).toBeDefined();
    expect(folderA!.projects).not.toHaveLength(0);
    expect(folderB!.projects).not.toHaveLength(0);
    expect(folderA!.projects[0].projectRootPath).toBe("etudianta.zip/Intra");
    expect(folderB!.projects[0].projectRootPath).toBe("etudiantb.zip/Intra");
    expect(folderA!.projects[0].score).toBe(100);
    expect(folderB!.projects[0].score).toBe(100);
  });

  it("détecte un projet Gradle dans des archives à plusieurs niveaux", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "1030", isDir: true },
      { path: "1030/StudentOne.zip", isDir: true },
      { path: "1030/StudentOne.zip/inner.zip", isDir: true },
      { path: "1030/StudentOne.zip/inner.zip/Intra", isDir: true },
      {
        path: "1030/StudentOne.zip/inner.zip/Intra/settings.gradle",
        isDir: false,
      },
      {
        path: "1030/StudentOne.zip/inner.zip/Intra/build.gradle",
        isDir: false,
      },
      {
        path: "1030/StudentOne.zip/inner.zip/Intra/gradle.properties",
        isDir: false,
      },
      { path: "1030/StudentOne.zip/inner.zip/Intra/src", isDir: true },
      {
        path: "1030/StudentOne.zip/inner.zip/Intra/src/main",
        isDir: true,
      },
      {
        path: "1030/StudentOne.zip/inner.zip/Intra/src/main/java",
        isDir: true,
      },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: gradleTemplate,
      reader,
      studentRootPath: "1030",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const studentFolder = results.find(
      (folder) => folder.name === "StudentOne.zip"
    );
    expect(studentFolder).toBeDefined();
    expect(studentFolder!.projects).not.toHaveLength(0);
    const project = studentFolder!.projects[0];
    expect(project.projectRootPath).toBe("1030/StudentOne.zip/inner.zip/Intra");
    expect(project.score).toBe(100);
    expect(
      project.templateMatches.every((match) => match.status === "found")
    ).toBe(true);
  });

  it("détecte un projet Gradle utilisant la DSL Kotlin", async () => {
    const entries: IZipEntryMeta[] = [
      { path: "StudentK", isDir: true },
      { path: "StudentK/settings.gradle.kts", isDir: false },
      { path: "StudentK/build.gradle.kts", isDir: false },
      { path: "StudentK/src", isDir: true },
      { path: "StudentK/src/main", isDir: true },
      { path: "StudentK/src/main/kotlin", isDir: true },
      { path: "StudentK/src/main/kotlin/App.kt", isDir: false },
    ];
    const reader = createMockReader(entries);

    const results = await analyzeZipWithReader({
      template: gradleTemplate,
      reader,
      studentRootPath: "",
      projectsPerStudent: 1,
      similarityThreshold: 80,
    });

    const studentFolder = results.find((folder) => folder.name === "StudentK");
    expect(studentFolder).toBeDefined();
    expect(studentFolder!.projects).not.toHaveLength(0);
    const project = studentFolder!.projects[0];
    expect(project.projectRootPath).toBe("StudentK");
    expect(project.score).toBe(100);
  });
});
