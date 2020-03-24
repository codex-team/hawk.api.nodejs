import { SchemaDirectiveVisitor } from 'apollo-server-express';
import { defaultFieldResolver, GraphQLArgument, GraphQLField, GraphQLInterfaceType, GraphQLObjectType } from 'graphql';
import { save } from '../utils/files';
import { FileUpload } from 'graphql-upload';

/**
 * Defines directive uploading images
 * This directive will automatically upload image and returns links for accessing it
 */
export default class UploadImageDirective extends SchemaDirectiveVisitor {
  /**
   * Method to be called on arguments visiting
   * Patches the resolver function to automatic download image
   * @param argument - information about argument where is image to upload
   * @param details - details about field to resolve
   */
  public visitArgumentDefinition(argument: GraphQLArgument, details: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    field: GraphQLField<any, any>;
    objectType: GraphQLObjectType | GraphQLInterfaceType;
  }): GraphQLArgument | void | null {
    const { resolve = defaultFieldResolver } = details.field;

    details.field.resolve = async (object, args, context, info): Promise<void> => {
      if (args[argument.name]) {
        const imageMeta = await (args[argument.name] as Promise<FileUpload>);

        args[argument.name] = save(imageMeta.createReadStream(), imageMeta.mimetype);
      }

      return resolve.call(this, object, args, context, info);
    };
  }
}
