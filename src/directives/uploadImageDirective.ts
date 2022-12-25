import {defaultFieldResolver, GraphQLSchema, InputValueDefinitionNode} from "graphql";
import {mapSchema, MapperKind, getDirective} from '@graphql-tools/utils'
import {BooleanValueNode} from "graphql/language/ast";
import {save} from "../utils/files";

export default function uploadImageDirective(directiveName = 'uploadImage') {
  return {
    uploadImageDirectiveTypeDefs: `
    """
    Directive for automatically image uploading
    """
    directive @${directiveName} on ARGUMENT_DEFINITION
    `,
    uploadImageDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig) => {
          const fieldArgs = fieldConfig.astNode?.arguments;
          if (fieldArgs) {
            fieldArgs.forEach(arg => {
              const directives = arg.directives;
              directives?.forEach(directive => {
                if (directive.name.value === directiveName) {
                  const {resolve = defaultFieldResolver} = fieldConfig;
                  fieldConfig.resolve = async (object, args, context, info) => {
                    if (args[arg.name.value]) {
                      const imageMeta = await (args[arg.name.value] as Promise<any>);

                      args[arg.name.value] = await save(imageMeta.file.createReadStream(), imageMeta.mimetype);
                    }
                    return resolve(object, args, context, info);
                  };
                }
              })
            })
          }
          return fieldConfig;
        }
      })
  }
}
