// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

struct SocialMedia {
  string xUrl;
  string telegramUrl;
  string discordUrl;
  string redditUrl;
  string facebookUrl;
  string instagramUrl;
}

struct TokenInfo {
  string description;
  string logoUrl;
  string websiteUrl;
  SocialMedia socialMedia;
}
