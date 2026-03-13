import { heroBlockSchema } from "@lmnas/blocks/Hero/schema.js";
import { conversionConfigSchema } from "../shared/conversionConfig.contract.js";

export type ContractPageType = "home" | "product" | "solution" | "industry" | "simple";

export interface BlockContractMeta {
  strapi: {
    schemaPath: string;
    collectionName: string;
    displayName: string;
    componentFields?: Record<string, string>;
  };
  governance: {
    phase: "M1";
    conversionBlock: boolean;
    requiresProductMapping: boolean;
    requiresConversionConfig: boolean;
    requiresPrimaryCta: boolean;
  };
  editor: {
    allowedOnPageTypes: ContractPageType[];
  };
}

export interface BlockContract {
  type: string;
  meta: BlockContractMeta;
  schema: unknown;
}

export const heroContract: BlockContract = {
  type: "hero",
  meta: {
    strapi: {
      schemaPath: "services/strapi/src/components/blocks/hero.json",
      collectionName: "components_blocks_heroes",
      displayName: "hero",
      componentFields: {
        conversionConfig: "shared.conversion-config"
      }
    },
    governance: {
      phase: "M1",
      conversionBlock: true,
      requiresProductMapping: true,
      requiresConversionConfig: true,
      requiresPrimaryCta: true
    },
    editor: {
      allowedOnPageTypes: ["home", "product", "solution", "industry", "simple"]
    }
  },
  schema: heroBlockSchema.extend({
    conversionConfig: conversionConfigSchema
  })
};
