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
    ctaHref: Schema.Attribute.String;
    ctaLabel: Schema.Attribute.String;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    primaryCta: Schema.Attribute.JSON & Schema.Attribute.Required;
    productMapping: Schema.Attribute.JSON & Schema.Attribute.Required;
    secondaryCta: Schema.Attribute.JSON;
    subheading: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface BlocksImportedDomSnapshot extends Struct.ComponentSchema {
  collectionName: 'components_blocks_imported_dom_snapshots';
  info: {
    displayName: 'imported-dom-snapshot';
  };
  attributes: {
    classMap: Schema.Attribute.JSON & Schema.Attribute.Required;
    domJson: Schema.Attribute.JSON & Schema.Attribute.Required;
    stylesheetRef: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ExitsExitAuditLog extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_audit_logs';
  info: {
    displayName: 'exit-audit-log';
  };
  attributes: {
    exitId: Schema.Attribute.String & Schema.Attribute.Required;
    reason: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<['success', 'failure', 'skipped']> &
      Schema.Attribute.Required;
    timestamp: Schema.Attribute.DateTime & Schema.Attribute.Required;
  };
}

export interface ExitsExitBinding extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_bindings';
  info: {
    displayName: 'exit-binding';
  };
  attributes: {
    exitId: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locationId: Schema.Attribute.String & Schema.Attribute.Required;
    locationType: Schema.Attribute.Enumeration<
      ['block', 'navbar', 'footer', 'page']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'block'>;
  };
}

export interface ExitsExitDefinition extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_definitions';
  info: {
    displayName: 'exit-definition';
  };
  attributes: {
    analyticsMapping: Schema.Attribute.JSON;
    backendAdapterType: Schema.Attribute.Enumeration<
      ['n8n_webhook', 'api', 'none']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'none'>;
    eventName: Schema.Attribute.String & Schema.Attribute.Required;
    exitId: Schema.Attribute.String & Schema.Attribute.Required;
    failureBehavior: Schema.Attribute.String;
    fallbackBehavior: Schema.Attribute.String;
    frontendAdapterType: Schema.Attribute.Enumeration<
      ['redirect', 'modal', 'form', 'chat_drawer', 'none']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'redirect'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    payloadSchema: Schema.Attribute.Component<
      'exits.exit-payload-schema',
      false
    >;
    policy: Schema.Attribute.Component<'exits.exit-policy', false>;
    state: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    successBehavior: Schema.Attribute.String;
    workflowTarget: Schema.Attribute.Component<
      'exits.exit-execution-target',
      false
    >;
  };
}

export interface ExitsExitExecutionTarget extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_execution_targets';
  info: {
    displayName: 'exit-execution-target';
  };
  attributes: {
    kind: Schema.Attribute.Enumeration<
      ['none', 'url', 'n8n_webhook', 'api', 'modal', 'chat_drawer']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'none'>;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ExitsExitPayloadSchema extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_payload_schemas';
  info: {
    displayName: 'exit-payload-schema';
  };
  attributes: {
    format: Schema.Attribute.Enumeration<
      ['json-schema', 'openapi-ref', 'typed-config']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'json-schema'>;
    schema: Schema.Attribute.JSON & Schema.Attribute.Required;
  };
}

export interface ExitsExitPolicy extends Struct.ComponentSchema {
  collectionName: 'components_exits_exit_policies';
  info: {
    displayName: 'exit-policy';
  };
  attributes: {
    environmentAllowlist: Schema.Attribute.JSON;
    roleAllowlist: Schema.Attribute.JSON;
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

export interface ShellFooterColumn extends Struct.ComponentSchema {
  collectionName: 'components_shell_footer_columns';
  info: {
    displayName: 'footer-column';
  };
  attributes: {
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    links: Schema.Attribute.Component<'shell.navigation-item', true>;
  };
}

export interface ShellFooterLegalStrip extends Struct.ComponentSchema {
  collectionName: 'components_shell_footer_legal_strips';
  info: {
    displayName: 'footer-legal-strip';
  };
  attributes: {
    copyrightText: Schema.Attribute.String & Schema.Attribute.Required;
    legalLinks: Schema.Attribute.Component<'shell.navigation-item', true>;
  };
}

export interface ShellFooterVariant extends Struct.ComponentSchema {
  collectionName: 'components_shell_footer_variants';
  info: {
    displayName: 'footer-variant';
  };
  attributes: {
    columns: Schema.Attribute.Component<'shell.footer-column', true>;
    legalStrip: Schema.Attribute.Component<'shell.footer-legal-strip', false>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    variantKey: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ShellNavbarVariant extends Struct.ComponentSchema {
  collectionName: 'components_shell_navbar_variants';
  info: {
    displayName: 'navbar-variant';
  };
  attributes: {
    announcementBarText: Schema.Attribute.String;
    ctaSlotLabel: Schema.Attribute.String;
    menu: Schema.Attribute.Component<'shell.navigation-menu', false>;
    mobileBehavior: Schema.Attribute.Enumeration<
      ['drawer', 'overlay', 'inline']
    > &
      Schema.Attribute.DefaultTo<'drawer'>;
    sticky: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    variantKey: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ShellNavigationGroup extends Struct.ComponentSchema {
  collectionName: 'components_shell_navigation_groups';
  info: {
    displayName: 'navigation-group';
  };
  attributes: {
    items: Schema.Attribute.Component<'shell.navigation-item', true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ShellNavigationItem extends Struct.ComponentSchema {
  collectionName: 'components_shell_navigation_items';
  info: {
    displayName: 'navigation-item';
  };
  attributes: {
    destinationType: Schema.Attribute.Enumeration<
      ['internal', 'external', 'asset', 'exit']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'internal'>;
    destinationValue: Schema.Attribute.String & Schema.Attribute.Required;
    exitId: Schema.Attribute.String;
    href: Schema.Attribute.String;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    submenuItems: Schema.Attribute.JSON;
  };
}

export interface ShellNavigationMenu extends Struct.ComponentSchema {
  collectionName: 'components_shell_navigation_menus';
  info: {
    displayName: 'navigation-menu';
  };
  attributes: {
    groups: Schema.Attribute.Component<'shell.navigation-group', true>;
    items: Schema.Attribute.Component<'shell.navigation-item', true>;
    menuKey: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ShellShellAssignment extends Struct.ComponentSchema {
  collectionName: 'components_shell_shell_assignments';
  info: {
    displayName: 'shell-assignment';
  };
  attributes: {
    footerVariantId: Schema.Attribute.String;
    navbarVariantId: Schema.Attribute.String;
    pageSlug: Schema.Attribute.String;
    scope: Schema.Attribute.Enumeration<['site', 'page']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'page'>;
    shellVariantId: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ShellShellVariant extends Struct.ComponentSchema {
  collectionName: 'components_shell_shell_variants';
  info: {
    displayName: 'shell-variant';
  };
  attributes: {
    description: Schema.Attribute.Text;
    footerVariant: Schema.Attribute.Component<'shell.footer-variant', false>;
    navbarVariant: Schema.Attribute.Component<'shell.navbar-variant', false>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    variantKey: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.faq': BlocksFaq;
      'blocks.hero': BlocksHero;
      'blocks.imported-dom-snapshot': BlocksImportedDomSnapshot;
      'exits.exit-audit-log': ExitsExitAuditLog;
      'exits.exit-binding': ExitsExitBinding;
      'exits.exit-definition': ExitsExitDefinition;
      'exits.exit-execution-target': ExitsExitExecutionTarget;
      'exits.exit-payload-schema': ExitsExitPayloadSchema;
      'exits.exit-policy': ExitsExitPolicy;
      'shared.conversion-config': SharedConversionConfig;
      'shared.seo': SharedSeo;
      'shell.footer-column': ShellFooterColumn;
      'shell.footer-legal-strip': ShellFooterLegalStrip;
      'shell.footer-variant': ShellFooterVariant;
      'shell.navbar-variant': ShellNavbarVariant;
      'shell.navigation-group': ShellNavigationGroup;
      'shell.navigation-item': ShellNavigationItem;
      'shell.navigation-menu': ShellNavigationMenu;
      'shell.shell-assignment': ShellShellAssignment;
      'shell.shell-variant': ShellShellVariant;
    }
  }
}
