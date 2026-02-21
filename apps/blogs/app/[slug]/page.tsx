import React from "react";
import type { Metadata } from "next";
import { track } from "@lmnas/analytics";
import { getBlogPostBySlug } from "@lmnas/integrations";
import { buildBlogSeo } from "@lmnas/seo-engine";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  const seo = buildBlogSeo(post);

  return {
    title: seo.meta.title,
    description: seo.meta.description,
    alternates: {
      canonical: seo.meta.canonical
    },
    robots: seo.meta.robots
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  const seo = buildBlogSeo(post);

  track("blog_detail_view", { app: "blogs", slug: post.slug });

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>{post.title}</h1>
      <p>{post.excerpt}</p>
      <p>Canonical: {seo.meta.canonical}</p>
      <article>{post.body}</article>
    </main>
  );
}
