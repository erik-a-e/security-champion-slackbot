const teamkatalog = require("../lib/teamkatalog");
const slack = require("../lib/slack");
const config = require("../config");
const { diffLists } = require("../lib/util");
const storage = require("../lib/storage");

const snapshotFile = "security-champions.json";

async function getMemberDiff(currentSnapshot) {
  const previousSnapshot = (await storage.fileExists(snapshotFile))
    ? JSON.parse((await storage.getFileContent(snapshotFile)).toString("utf8"))
    : currentSnapshot;
  const identityMapper = (item) => item.group.id + "/" + item.navIdent;
  const diff = diffLists(previousSnapshot, currentSnapshot, identityMapper);

  if (!config.DRY_RUN) {
    const json = JSON.stringify(currentSnapshot, undefined, 2);
    await storage.setFileContents(snapshotFile, json);
  }
  return diff;
}

function createLookupMap(list, lookupMapper) {
  const mappedItems = {};
  list.forEach((item) => (mappedItems[lookupMapper(item)] = item));
  return mappedItems;
}

async function lookupDiffUsersInSlack(diff) {
  const slackUsers = await slack.getAllUsers();
  const slackByName = createLookupMap(slackUsers, (user) =>
    user.name?.toLowerCase()
  );
  const slackByEmail = createLookupMap(slackUsers, (user) =>
    user.profile?.email?.toLowerCase()
  );

  const mapper = (teamkatalogUser) => {
    const slackUser =
      slackByName[teamkatalogUser.navIdent.toLowerCase()] ??
      slackByEmail[teamkatalogUser.resource.email.toLowerCase()];
    return { ...teamkatalogUser, slackUser };
  };

  return {
    added: diff.added.map(mapper),
    removed: diff.removed.map(mapper),
    unchanged: diff.unchanged.map(mapper),
  };
}

function userSlackBlock(slackUser, markdownMessage) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: markdownMessage,
    },
    accessory: {
      type: "image",
      image_url: slackUser.profile.image_192,
      alt_text: slackUser.profile.real_name,
    },
  };
}

async function broadcastDiff(diffWithSlack) {
  const { added, removed, unchanged } = diffWithSlack;
  console.log(
    `${added.length} added, ${removed.length} removed, ${unchanged.length} unchanged`
  );

  const addedBlocks = added.map((user) =>
    userSlackBlock(
      user.slackUser,
      `:tada: *<${user.group.links.ui} | ${user.group.name}>* har fått seg en ny Security Champion!\n:security-champion: ${user.slackUser.profile.real_name} (<@${user.slackUser.id}>)\n\nVelkommen! :meow_wave: :security-pepperkake:`
    )
  );
  const removedBlocks = removed.map((user) =>
    userSlackBlock(
      user.slackUser,
      `:sadpanda: Security Champion fjernet fra *<${user.group.links.ui} | ${user.group.name}>*\n<@${user.slackUser.id}>`
    )
  );

  const simpleMessageParts = ["Oppdatering av Security Champions"];
  if (added.length) {
    const addedMessages = added.map(
      (user) =>
        `- <@${user.slackUser.id}> (<${user.group.links.ui} | ${user.group.name}>)`
    );
    simpleMessageParts.push("*Lagt til:*", ...addedMessages);
  }
  if (removed.length) {
    const removedMessages = removed.map(
      (user) =>
        `- <@${user.slackUser.id}> (<${user.group.links.ui} | ${user.group.name}>)`
    );
    simpleMessageParts.push("*Fjernet:*", ...removedMessages);
  }

  await slack.sendMessage(config.SECURITY_CHAMPION_ADMIN_CHANNEL, {
    text: simpleMessageParts.join("\n"),
    blocks: [
      {
        type: "divider",
      },
      ...removedBlocks,
      ...addedBlocks,
    ],
  });
  await slack.sendMessage(config.SECURITY_CHAMPION_CHANNEL, {
    text: simpleMessageParts.join("\n"),
    blocks: [...addedBlocks],
  });
}

module.exports = async function cmdSync() {
  const members = await teamkatalog.getMembersWithRole("SECURITY_CHAMPION");
  if (!members.length) {
    console.error("Could not find any security champions");
    process.exit(1);
  }

  console.log(`Found ${members.length} security champions`);

  const diff = await getMemberDiff(members);
  if (diff.added.length === 0 && diff.removed.length === 0) {
    console.log(`No changes detected (${diff.unchanged.length} unchanged)`);
    return;
  }

  const diffWithSlack = await lookupDiffUsersInSlack(diff);
  await broadcastDiff(diffWithSlack);
};
