// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../structs/TokenInfo.sol';

library TokenUtils {
  error InvalidTokenInfo();

  uint8 private constant MAX_NAME_LENGTH = 20;
  uint8 private constant MAX_SYMBOL_LENGTH = 20;
  uint8 private constant MAX_DESCRIPTION_LENGTH = 255;
  uint8 private constant MAX_URL_LENGTH = 255;

  function validateTokenInfo(string memory name, string memory symbol, TokenInfo memory info) internal pure {
    bytes memory nameBytes = bytes(name);
    bytes memory symbolBytes = bytes(symbol);
    bytes memory descriptionBytes = bytes(info.description);

    if (
      nameBytes.length == 0 ||
      nameBytes.length > MAX_NAME_LENGTH ||
      symbolBytes.length == 0 ||
      symbolBytes.length > MAX_SYMBOL_LENGTH ||
      descriptionBytes.length == 0 ||
      descriptionBytes.length > MAX_DESCRIPTION_LENGTH ||
      !_validateUrl(info.logoUrl, 'https://', true) ||
      !_validateUrl(info.websiteUrl, 'https://', false)
    ) {
      revert InvalidTokenInfo();
    }

    SocialMedia memory socialMedia = info.socialMedia;

    if (
      !_validateUrl(socialMedia.xUrl, 'https://x.com/', false) ||
      !_validateUrl(socialMedia.telegramUrl, 'https://t.me/', false) ||
      !_validateUrl(socialMedia.discordUrl, 'https://discord.gg/', false) ||
      !_validateUrl(socialMedia.redditUrl, 'https://reddit.com/r/', false) ||
      !_validateUrl(socialMedia.facebookUrl, 'https://facebook.com/', false) ||
      !_validateUrl(socialMedia.instagramUrl, 'https://instagram.com/', false)
    ) {
      revert InvalidTokenInfo();
    }
  }

  function _validateUrl(string memory url, string memory prefix, bool isRequired) private pure returns (bool) {
    bytes memory urlBytes = bytes(url);
    bytes memory prefixBytes = bytes(prefix);
    if ((urlBytes.length == 0 && !isRequired) || prefixBytes.length == 0) {
      return true;
    }
    if (urlBytes.length > MAX_URL_LENGTH || urlBytes.length < prefixBytes.length + 1) {
      return false;
    }
    return _startsWith(urlBytes, prefixBytes);
  }

  function _startsWith(bytes memory strBytes, bytes memory prefixBytes) private pure returns (bool) {
    if (prefixBytes.length > strBytes.length) {
      return false;
    }
    for (uint256 i = 0; i < prefixBytes.length; i++) {
      if (strBytes[i] != prefixBytes[i]) {
        return false;
      }
    }
    return true;
  }
}
