/**
 * @file Read all schemas in directory and concatenate them
 */
const { gql } = require('apollo-server-express');
const fs = require('fs');

const schema = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.graphql'))
  .map(fileName => fs.readFileSync(`${__dirname}/${fileName}`).toString())
  .join();

module.exports = gql(schema);
