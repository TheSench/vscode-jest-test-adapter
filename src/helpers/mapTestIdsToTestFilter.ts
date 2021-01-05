import _ from 'lodash';
import { ITestFilter } from "../types";
import escapeRegExp from "./escapeRegExp";
import { mapStringToId, Id } from "./idMaps";
import { PROJECT_ID_SEPARATOR, DESCRIBE_ID_SEPARATOR, TEST_ID_SEPARATOR } from "../constants";

export function mapTestIdToTestIdPattern(test: Id): string {
  const projectId = escapeRegExp(test.projectId);
  const fileName = escapeRegExp(test.fileName || '');
  const describesAndTest = mapTestIdToTestNamePattern(test, true);

  return `^${projectId}${PROJECT_ID_SEPARATOR}${fileName}${DESCRIBE_ID_SEPARATOR}${describesAndTest}`;
}

export function mapTestIdToDescribeIdPattern(test: Id): string {
  let regex = mapTestIdToTestIdPattern(test);
  // Each layer of nesting is wrapped in a ( )? so that this pattern handles partial matches
  const separators = new RegExp(`(${DESCRIBE_ID_SEPARATOR}|${TEST_ID_SEPARATOR})`, 'g');
  regex = regex.replace(separators, '($1');
  // Make sure that a match containing the test ID must end there
  const testName = new RegExp(`(${TEST_ID_SEPARATOR}.*)`);
  regex = regex.replace(testName, '$1$');
  const endingGroups = (regex.match(separators) || []).map(n => ')?').join('');
  return regex + endingGroups + '$';
}

export function mapTestIdToTestNamePattern(test: Id, useSeparators: boolean = false): string {
  // Jest test names are a concatenation of the describeIds and testId, separated by space
  const describeIds = (test.describeIds || [])
    .filter(testPart => testPart)
    .map(part => escapeRegExp(part))
    .join(useSeparators ? DESCRIBE_ID_SEPARATOR : ' ');
  
  const testId = [test.testId || '']
    .map(testId => escapeRegExp(testId || ""));

  return [describeIds].concat(testId)
    .map(testPart => replacePrintfPatterns(testPart)) // Handle any tokens in describe.each or it.each
    .join(useSeparators ? TEST_ID_SEPARATOR : ' ');
}

function replacePrintfPatterns(testId: string): string {
  return testId.replace(/%./g, (match: string) => {
    switch (match[1]) {
        case 'i': // %i - Integer.
        case '#': // %# - Index of the test case.
          return '\\d*';
        case 'd': // %d- Number.
        case 'f': // %f - Floating point value.
          return '\\d*(\\.\\d*)?'
        case 'p': // %p - pretty-format.
        case 's': // %s- String.
        case 'j': // %j - JSON.
        case 'o': // %o - Object.
          return '.*';
        case '%': // %% - single percent sign ('%'). This does not consume an argument.
        default:  // Leave everything else alone
          return match;
    }
  });
}

export function mapTestIdsToTestFilter(tests: string[]): ITestFilter | null {
  if (tests.length === 0 || tests.some(t => t === "root")) {
    return null;
  }

  const ids = tests.map(t => mapStringToId(t));

  // if there are any ids that do not contain a fileName, then we should run all the tests in the project.
  if (_.some(ids, x => !x.fileName)) {
    return null;
  }

  // we accumulate the file and test names into regex expressions.  Note we escape the names to avoid interpreting
  // any regex control characters in the file or test names.
  const testNamePattern = ids.map(id => mapTestIdToTestNamePattern(id))
    .filter(testId => testId)
    .join("|");
  const testFileNamePattern = ids.filter(x => x.fileName).map(z => escapeRegExp(z.fileName || "")).join("|");

  return {
    testFileNamePattern,
    testNamePattern,
  };
}
