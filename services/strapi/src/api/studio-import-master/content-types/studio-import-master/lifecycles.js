"use strict";

const { errors } = require("@strapi/utils");
const { ApplicationError } = errors;

module.exports = {
  async beforeDelete(event) {
    const { params } = event;
    const { where } = params;

    // We need to fetch the record first to get its ID if where doesn't contain it directly
    // but usually Strapi passes the ID in where for individual deletes.
    const master = await strapi.query("api::studio-import-master.studio-import-master").findOne({
      where,
      populate: {
        blocks: {
          count: true,
        },
      },
    });

    if (!master) {
      return;
    }

    // Checking if there are any related blocks
    // Note: 'blocks' is the relation attribute name in studio-import-master schema
    const blocksCount = await strapi.query("api::studio-block.studio-block").count({
      where: {
        importMaster: master.id,
      },
    });

    if (blocksCount > 0) {
      throw new ApplicationError(
        `Cannot delete Import Master "${master.importKey}" because it has ${blocksCount} associated blocks. Delete the blocks first.`
      );
    }
  },

  async beforeDeleteMany(event) {
    const { params } = event;
    const { where } = params;

    const masters = await strapi.query("api::studio-import-master.studio-import-master").findMany({
      where,
    });

    for (const master of masters) {
      const blocksCount = await strapi.query("api::studio-block.studio-block").count({
        where: {
          importMaster: master.id,
        },
      });

      if (blocksCount > 0) {
        throw new ApplicationError(
          `Cannot delete Import Master "${master.importKey}" because it has associated blocks. Delete the blocks first.`
        );
      }
    }
  },
};
