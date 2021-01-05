import {
  DescribeNode,
  FileNode,
  FileWithParseErrorNode,
  FolderNode,
  ProjectRootNode,
  TestNode,
  WorkspaceRootNode,
} from "./tree";
import { mapTestIdToTestIdPattern, mapTestIdToDescribeIdPattern } from "./mapTestIdsToTestFilter";
import { mapStringToId } from "./idMaps";

function filterTree(tree: WorkspaceRootNode, testNames: string[], useRegex: boolean): WorkspaceRootNode;
function filterTree(tree: ProjectRootNode, testNames: string[], useRegex: boolean): ProjectRootNode;
function filterTree(
  tree: WorkspaceRootNode | ProjectRootNode,
  testNames: string[],
  useRegex: boolean,
): WorkspaceRootNode | ProjectRootNode {
  if (testNames.length === 0 || testNames[0] === "root") {
    return tree;
  }

  switch (tree.type) {
    case "workspaceRootNode":
      return filterWorkspace(tree as WorkspaceRootNode, testNames, useRegex);

    case "projectRootNode":
      return filterProject(tree as ProjectRootNode, testNames, useRegex);
  }
}

const filterWorkspace = (tree: WorkspaceRootNode, testNames: string[], useRegex: boolean): WorkspaceRootNode => {
  return {
    ...tree,
    projects: tree.projects.map(p => filterProject(p, testNames, useRegex)),
  };
};

const filterProject = (project: ProjectRootNode, testNames: string[], useRegex: boolean): ProjectRootNode => {
  // if we have been passed a test name that is an exact match for a project, then we should return the whole project.
  if (testNames.some(t => t === project.id)) {
    return project;
  }

  return {
    ...project,
    files: filterFiles(project.files, testNames, useRegex),
    folders: filterFolders(project.folders, testNames, useRegex),
  };
};

const filterFolders = (folders: FolderNode[], testNames: string[], useRegex: boolean): FolderNode[] => {
  return folders
    .filter(folder => testNames.some(testName => testName.startsWith(folder.id)))
    .map(folder => {
      if (testNames.some(testName => testName === folder.id)) {
        return folder;
      }
      return {
        ...folder,
        folders: filterFolders(folder.folders, testNames, useRegex),
        files: filterFiles(folder.files, testNames, useRegex)
      };
    });
};

const filterFiles = (
  files: Array<FileNode | FileWithParseErrorNode>,
  testNames: string[],
  useRegex: boolean,
): Array<FileNode | FileWithParseErrorNode> => {
  return files
    .filter(file => testNames.some(testName => testName.startsWith(file.id)))
    .reduce((acc, file) => {
      if (testNames.some(testName => testName === file.id)) {
        acc.push(file);
      } else {
      switch (file.type) {
        case "file":
          acc.push({
            ...file,
            describeBlocks: filterDescribeBlocks(file.describeBlocks, testNames, useRegex),
            tests: filterTests(file.tests, testNames, useRegex),
          });
          break;

        case "fileWithParseError":
          // In this edge case where we are asked to filter files that start with this file name but is not an exact match
          // This means we want to filter by describe or test blocks within this file, but we didn't parse it successfully
          // we'll include this file in the results.
          acc.push(file);
          break;
      }
    }

      return acc;
    }, [] as Array<FileNode | FileWithParseErrorNode>);
};

const filterDescribeBlocks = (describeBlocks: DescribeNode[], testNames: string[], useRegex: boolean): DescribeNode[] => {
  let filteredDescribeBlocks;
  if (useRegex) {
    const testNamePatterns = testNames.map(testName => new RegExp(mapTestIdToDescribeIdPattern(mapStringToId(testName))));
    filteredDescribeBlocks = describeBlocks
      .filter(describe => testNamePatterns.some(pattern => pattern.test(describe.id)));
  } else {
    filteredDescribeBlocks = describeBlocks
      .filter(describe => testNames.some(testName => testName.startsWith(describe.id)));
  }

  return filteredDescribeBlocks
    .map(describe => {
      if (testNames.some(testName => testName === describe.id)) {
        return describe;
      }
      return {
        ...describe,
        describeBlocks: filterDescribeBlocks(describe.describeBlocks, testNames, useRegex),
        tests: filterTests(describe.tests, testNames, useRegex)
      };
    });
};

const filterTests = (tests: TestNode[], testNames: string[], useRegex: boolean): TestNode[] => {
  if (useRegex) {
    const testNamePatterns = testNames.map(testName => new RegExp(mapTestIdToTestIdPattern(mapStringToId(testName))));
    return tests.filter(test => testNamePatterns.some(pattern => pattern.test(test.id)));
  } else {
    return tests.filter(test => testNames.some(testName => testName.startsWith(test.id)));
  }
};

export { filterTree };
