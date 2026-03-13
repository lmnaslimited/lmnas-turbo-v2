import React from "react";
import { track } from "@lmnas/analytics";
import { getBlogPosts } from "@lmnas/integrations";

export default async function SiteBlogsPage() {
  const posts = await getBlogPosts();
  track("blog_list_view", { app: "site", count: posts.length });

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Blogs</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <a href={`/blogs/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
