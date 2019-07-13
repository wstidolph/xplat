import {
  chain,
  Tree,
  SchematicContext,
  SchematicsException,
  // schematic,
  Rule,
  noop,
  externalSchematic
} from '@angular-devkit/schematics';
import {
  supportedPlatforms,
  prerun,
  unsupportedPlatformError,
  formatFiles,
  FeatureHelpers
} from '@nstudio/xplat';

export default function(options: FeatureHelpers.Schema) {
  const featureSettings = FeatureHelpers.prepare(options);

  const externalChains = [];
  for (const platform of featureSettings.platforms) {
    if (supportedPlatforms.includes(platform)) {
      externalChains.push(
        externalSchematic(`@nstudio/${platform}-angular`, 'feature', options, {
          interactive: false
        })
      );
    } else {
      throw new SchematicsException(unsupportedPlatformError(platform));
    }
  }

  return chain([
    prerun(),
    // libs
    (tree: Tree, context: SchematicContext) =>
      options.onlyProject
        ? noop()(tree, context)
        : FeatureHelpers.addFiles(options)(tree, context),
    // libs
    (tree: Tree, context: SchematicContext) =>
      options.onlyProject || !options.createBase || options.onlyModule
        ? noop()(tree, context)
        : FeatureHelpers.addFiles(options, null, null, '_component')(
            tree,
            context
          ),
    // update libs index
    (tree: Tree, context: SchematicContext) =>
      options.onlyProject
        ? noop()(tree, context)
        : FeatureHelpers.adjustBarrelIndex(options, 'libs/features/index.ts')(
            tree,
            context
          ),
    // external schematic handling
    ...externalChains,
    options.skipFormat ? noop() : formatFiles(options)
  ]);
}
