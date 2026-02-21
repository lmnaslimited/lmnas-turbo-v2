import type { Schema, Attribute } from '@strapi/strapi';

export interface SharedSeo extends Schema.Component {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'seo';
  };
  attributes: {
    metaTitle: Attribute.String;
    metaDescription: Attribute.Text;
    canonical: Attribute.String;
    robots: Attribute.String;
  };
}

export interface SharedConversionConfig extends Schema.Component {
  collectionName: 'components_shared_conversion_configs';
  info: {
    displayName: 'conversionConfig';
  };
  attributes: {
    primary: Attribute.Enumeration<
      ['book', 'benefit', 'download', 'subscribe']
    > &
      Attribute.Required;
    product: Attribute.String & Attribute.Required;
    industry: Attribute.String & Attribute.Required;
  };
}

export interface BlocksHero extends Schema.Component {
  collectionName: 'components_blocks_heroes';
  info: {
    displayName: 'hero';
  };
  attributes: {
    heading: Attribute.String & Attribute.Required;
    subheading: Attribute.String & Attribute.Required;
    ctaLabel: Attribute.String & Attribute.Required;
    ctaHref: Attribute.String & Attribute.Required;
  };
}

export interface BlocksFaq extends Schema.Component {
  collectionName: 'components_blocks_faqs';
  info: {
    displayName: 'faq';
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    items: Attribute.JSON & Attribute.Required;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'shared.seo': SharedSeo;
      'shared.conversion-config': SharedConversionConfig;
      'blocks.hero': BlocksHero;
      'blocks.faq': BlocksFaq;
    }
  }
}
