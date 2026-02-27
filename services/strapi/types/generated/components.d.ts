import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksFaq extends Struct.ComponentSchema {
  collectionName: 'components_blocks_faqs';
  info: {
    displayName: 'faq';
  };
  attributes: {
    items: Schema.Attribute.JSON & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface BlocksHero extends Struct.ComponentSchema {
  collectionName: 'components_blocks_heroes';
  info: {
    displayName: 'hero';
  };
  attributes: {
    conversionConfig: Schema.Attribute.Component<
      'shared.conversion-config',
      false
    > &
      Schema.Attribute.Required;
    ctaHref: Schema.Attribute.String & Schema.Attribute.Required;
    ctaLabel: Schema.Attribute.String & Schema.Attribute.Required;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    subheading: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedConversionConfig extends Struct.ComponentSchema {
  collectionName: 'components_shared_conversion_configs';
  info: {
    displayName: 'conversionConfig';
  };
  attributes: {
    benefitKey: Schema.Attribute.String;
    campaignId: Schema.Attribute.String;
    destination: Schema.Attribute.JSON;
    eventCategory: Schema.Attribute.Enumeration<
      ['conversion', 'engagement', 'navigation', 'experiment']
    >;
    eventName: Schema.Attribute.String & Schema.Attribute.Required;
    intent: Schema.Attribute.Enumeration<
      ['book', 'run_benefit', 'download', 'subscribe']
    > &
      Schema.Attribute.Required;
    utmDefaults: Schema.Attribute.JSON;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'seo';
  };
  attributes: {
    canonical: Schema.Attribute.String & Schema.Attribute.Required;
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    robots: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.faq': BlocksFaq;
      'blocks.hero': BlocksHero;
      'shared.conversion-config': SharedConversionConfig;
      'shared.seo': SharedSeo;
    }
  }
}
