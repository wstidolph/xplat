import {
  PlatformTypes,
  supportedSandboxPlatforms,
  supportedPlatforms,
  getDefaultTemplateOptions,
  stringUtils
} from './general';
import {
  SchematicsException,
  branchAndMerge,
  mergeWith,
  apply,
  url,
  template,
  move,
  Tree,
  Rule
} from '@angular-devkit/schematics';
import {
  platformAppPrefixError,
  generatorError,
  optionsMissingError
} from './errors';
import { createSourceFile, ScriptTarget } from 'typescript';
import { insert, addGlobal } from './ast';

export namespace FeatureHelpers {
  export interface Schema {
    name: string;
    /**
     * Target apps
     */
    projects?: string;
    /**
     * Target platforms
     */
    platforms?: string;
    /**
     * Only generate for specified projects and ignore shared code
     */
    onlyProject?: boolean;
    /**
     * Only generate the module and ignore default component creation
     */
    onlyModule?: boolean;
    /**
     * Configure routing
     */
    routing?: boolean;
    /**
     * Create base component for maximum code sharing
     */
    createBase?: boolean;
    /**
     * Add link to route for sandbox
     */
    adjustSandbox?: boolean;
    /**
     * Skip formatting
     */
    skipFormat?: boolean;
  }

  export function prepare(
    options: Schema
  ): {
    featureName: string;
    projectNames: Array<string>;
    platforms: Array<PlatformTypes>;
  } {
    if (!options.name) {
      throw new SchematicsException(
        `You did not specify the name of the feature you'd like to generate. For example: ng g feature my-feature`
      );
    }
    const featureName = options.name.toLowerCase();
    let projects = options.projects;
    let projectNames: Array<string>;
    let platforms = [];
    if (options.adjustSandbox) {
      // when adjusting sandbox for the feature, turn dependent options on
      // for convenience also setup some default fallbacks to avoid requiring so many options
      // sandbox flags are meant to be quick and convenient
      options.onlyProject = true;
      options.routing = true;
      if (!projects) {
        if (!options.platforms) {
          // default to {N} sandbox
          projects = 'nativescript-sandbox';
        } else {
          platforms = options.platforms.split(',');
          const projectSandboxNames = [];
          // default to project with sandbox name
          for (const p of platforms) {
            if (supportedSandboxPlatforms.includes(p)) {
              projectSandboxNames.push(`${p}-sandbox`);
            } else {
              throw new SchematicsException(
                `The --adjustSandbox flag supports the following at the moment: ${supportedSandboxPlatforms}`
              );
            }
          }
          projects = projectSandboxNames.join(',');
        }
      }
    }
    if (options.routing && !options.onlyProject) {
      throw new SchematicsException(
        `When generating a feature with the --routing option, please also specify --onlyProject. Support for shared code routing is under development.`
      );
    }

    if (projects) {
      // building feature in shared code and in projects
      projectNames = projects.split(',');
      for (const name of projectNames) {
        const platPrefix = <PlatformTypes>name.split('-')[0];
        if (
          supportedPlatforms.includes(platPrefix) &&
          !platforms.includes(platPrefix)
        ) {
          // if project name is prefixed with supported platform and not already added
          platforms.push(platPrefix);
        }
      }
    } else if (options.platforms) {
      // building feature in shared code only
      platforms = options.platforms.split(',');
    }
    if (platforms.length === 0) {
      let error = projects
        ? platformAppPrefixError()
        : generatorError('feature');
      throw new SchematicsException(optionsMissingError(error));
    }
    return { featureName, projectNames, platforms };
  }

  export function addFiles(
    options: Schema,
    target: string = '',
    projectName: string = '',
    extra: string = ''
  ) {
    let moveTo: string;
    if (target) {
      moveTo = getMoveTo(options, target, projectName);
    } else {
      target = 'lib';
      moveTo = `libs/features/${options.name.toLowerCase()}`;
    }
    return branchAndMerge(
      mergeWith(
        apply(url(`./${extra}_files`), [
          template(getTemplateOptions(options)),
          move(moveTo)
        ])
      )
    );
  }

  export function adjustBarrelIndex(
    options: Schema,
    indexFilePath: string
  ): Rule {
    return (host: Tree) => {
      const indexSource = host.read(indexFilePath)!.toString('utf-8');
      const indexSourceFile = createSourceFile(
        indexFilePath,
        indexSource,
        ScriptTarget.Latest,
        true
      );

      insert(host, indexFilePath, [
        ...addGlobal(
          indexSourceFile,
          indexFilePath,
          `export * from './${options.name.toLowerCase()}';`,
          true
        )
      ]);
      return host;
    };
  }

  export function getTemplateOptions(options: Schema) {
    const nameParts = options.name.split('-');
    let endingDashName = nameParts[0];
    if (nameParts.length > 1) {
      endingDashName = stringUtils.capitalize(nameParts[nameParts.length - 1]);
    }
    return {
      ...(options as any),
      ...getDefaultTemplateOptions(),
      name: options.name.toLowerCase(),
      endingDashName
    };
  }

  export function getMoveTo(
    options: Schema,
    platform: string,
    projectName?: string
  ) {
    const featureName = options.name.toLowerCase();
    let moveTo = `xplat/${platform}/features/${featureName}`;
    if (projectName) {
      let appDir = platform === 'web' ? '/app' : '';
      moveTo = `apps/${projectName}/src${appDir}/features/${featureName}`;
      // console.log('moveTo:', moveTo);
    }
    return moveTo;
  }
}