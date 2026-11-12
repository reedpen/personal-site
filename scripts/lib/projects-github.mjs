const pinnedQuery = `query($owner: String!) {
  user(login: $owner) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { nameWithOwner isPrivate isFork isArchived owner { login } } }
    }
  }
}`;

export async function discoverRepos(runner, policy) {
  if (policy.discover === "none") return [];
  if (policy.discover === "pinned") {
    const { stdout } = await runner("gh", [
      "api",
      "graphql",
      "-f",
      `query=${pinnedQuery}`,
      "-f",
      `owner=${policy.owner}`,
    ]);
    const result = JSON.parse(stdout);
    if (result.errors?.length || !result.data?.user)
      throw new Error(
        `GitHub pinned query failed: ${JSON.stringify(result.errors ?? "user not found")}`,
      );
    return result.data.user.pinnedItems.nodes
      .filter(Boolean)
      .map((repo) => ({ repo: repo.nameWithOwner, private: repo.isPrivate }));
  }
  const { stdout } = await runner("gh", [
    "api",
    "--paginate",
    "--slurp",
    `users/${policy.owner}/repos?type=owner&per_page=100`,
  ]);
  return JSON.parse(stdout)
    .flat()
    .filter(
      (repo) =>
        !repo.private &&
        !repo.fork &&
        !repo.archived &&
        repo.owner.login.toLowerCase() === policy.owner.toLowerCase(),
    )
    .map((repo) => ({ repo: repo.full_name, private: false }));
}

export async function repoMetadata(runner, repo) {
  const { stdout } = await runner("gh", ["api", `repos/${repo}`]);
  const result = JSON.parse(stdout);
  if (
    typeof result.private !== "boolean" ||
    typeof result.default_branch !== "string" ||
    !result.default_branch ||
    typeof result.pushed_at !== "string"
  )
    throw new Error(`Invalid GitHub metadata for ${repo}`);
  return result;
}

export async function headCommit(runner, repo, branch) {
  const { stdout } = await runner("gh", [
    "api",
    `repos/${repo}/commits/${encodeURIComponent(branch)}`,
  ]);
  const { sha } = JSON.parse(stdout);
  if (typeof sha !== "string" || !/^[0-9a-f]{40,64}$/i.test(sha))
    throw new Error(`Invalid GitHub commit for ${repo}`);
  return sha;
}
