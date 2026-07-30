// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import './interfaces/ILaunchpad.sol';
import './libs/DexUtils.sol';
import './libs/MarketUtils.sol';
import './libs/TokenUtils.sol';
import './storages/LaunchpadStorage.sol';
import './structs/TokenInfo.sol';
import './LaunchpadAdmin.sol';
import './Token.sol';

contract Launchpad is ILaunchpad, LaunchpadAdmin {
  using SafeERC20 for Token;
  using LaunchpadStorage for LaunchpadStorage.State;
  using MarketUtils for LaunchpadStorage.MarketData;

  event TokenLaunched(
    address indexed token,
    address indexed creator,
    string name,
    string symbol,
    string description,
    string logoUrl,
    string websiteUrl,
    string xUrl,
    string telegramUrl,
    string discordUrl,
    string redditUrl,
    string facebookUrl,
    string instagramUrl
  );
  event TokensBought(address indexed token, address indexed buyer, uint256 tokenAmount, uint256 cost, uint256 fee);
  event TokensSold(address indexed token, address indexed seller, uint256 tokenAmount, uint256 payout, uint256 fee);
  event MarketDataCreated(
    address indexed token,
    uint256 tokenTotalSupply,
    uint256 bondingCurveSupply,
    uint256 tokenPrice,
    uint256 tokenFinalPrice
  );
  event MarketDataUpdated(address indexed token, uint256 ethReserve, uint256 tokenReserve, uint256 tokenPrice);
  event TokenMigrated(
    address indexed token,
    address indexed dexPool,
    uint256 tokenId,
    uint256 ethLiquidity,
    uint256 tokenLiquidity
  );

  error MarketIsPaused();
  error TokenAlreadyMigrated(address token);
  error InvalidAmount(uint256 amount);
  error SlippageLimitExceeded(uint256 minExpected, uint256 current);
  error NoTokenLiquidity(uint256 available, uint256 requested);
  error NoEthLiquidity(uint256 available, uint256 requested);
  error InsufficientAllowance(uint256 expected, uint256 allowed);

  function bondingCurveSupply() external view returns (uint256) {
    return LaunchpadStorage.get().supplyParams.bondingCurveSupply;
  }

  function launchToken(
    string memory name,
    string memory symbol,
    TokenInfo memory info
  ) external payable nonReentrant returns (Token) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();

    TokenUtils.validateTokenInfo(name, symbol, info);

    Token token = new Token(name, symbol, state.supplyParams.tokenTotalSupply, address(this), msg.sender);

    (uint256 ethVirtualReserve, uint256 tokenVirtualReserve) = MarketUtils.calculateVirtualReserves(state);

    LaunchpadStorage.MarketData storage marketData = state.marketDataByToken[address(token)];
    marketData.tokenTotalSupply = state.supplyParams.tokenTotalSupply;
    marketData.bondingCurveSupply = state.supplyParams.bondingCurveSupply;
    marketData.ethVirtualReserve = ethVirtualReserve;
    marketData.tokenReserve = state.supplyParams.bondingCurveSupply;
    marketData.tokenVirtualReserve = tokenVirtualReserve;
    marketData.tokenPrice = marketData.priceOf();
    marketData.tokenFinalPrice = marketData.finalPriceOf();

    emit TokenLaunched(
      address(token),
      msg.sender,
      name,
      symbol,
      info.description,
      info.logoUrl,
      info.websiteUrl,
      info.socialMedia.xUrl,
      info.socialMedia.telegramUrl,
      info.socialMedia.discordUrl,
      info.socialMedia.redditUrl,
      info.socialMedia.facebookUrl,
      info.socialMedia.instagramUrl
    );
    emit MarketDataCreated(
      address(token),
      marketData.tokenTotalSupply,
      marketData.bondingCurveSupply,
      marketData.tokenPrice,
      marketData.tokenFinalPrice
    );

    if (msg.value > 0) {
      (uint256 tokensToBuy, ) = marketData.estimateTokensToBuy(state, msg.value);
      _buyTokens(token, msg.value, tokensToBuy);
    }

    return token;
  }

  function buyTokens(Token token, uint256 minExpectedTokens) external payable nonReentrant returns (uint256) {
    return _buyTokens(token, msg.value, minExpectedTokens);
  }

  function sellTokens(
    Token token,
    uint256 tokenAmount,
    uint256 minExpectedEth
  ) external nonReentrant returns (uint256) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();

    if (state.isMarketPaused) {
      revert MarketIsPaused();
    }

    if (tokenAmount == 0) {
      revert InvalidAmount(tokenAmount);
    }

    LaunchpadStorage.MarketData storage marketData = state.marketDataOf(token);
    if (marketData.dexPool != address(0)) {
      revert TokenAlreadyMigrated(address(token));
    }

    uint256 tokensAllowed = token.allowance(msg.sender, address(this));
    if (tokenAmount > tokensAllowed) {
      revert InsufficientAllowance(tokenAmount, tokensAllowed);
    }

    (uint256 payout, uint256 fee) = marketData.estimateEthForSellingTokens(state, tokenAmount);
    if (payout < minExpectedEth) {
      revert SlippageLimitExceeded(minExpectedEth, payout);
    }

    uint256 ethBalance = address(this).balance;
    if (ethBalance < payout || marketData.ethReserve < payout) {
      revert NoEthLiquidity(ethBalance, payout);
    }

    marketData.tokenReserve += tokenAmount;
    marketData.ethReserve -= (payout + fee);
    marketData.tokenPrice = marketData.priceOf();

    token.safeTransferFrom(msg.sender, address(this), tokenAmount);

    payable(msg.sender).transfer(payout);
    _distributeFeeOrReward(token, state, state.rewardParams.tradeFeeShare, fee);

    emit TokensSold(address(token), msg.sender, tokenAmount, payout, fee);
    _emitMarketDataUpdated(token, marketData);

    return payout;
  }

  function estimateFirstTokensToBuy(uint256 ethAmount) external view returns (uint256) {
    return MarketUtils.estimateFirstTokensToBuy(LaunchpadStorage.get(), ethAmount);
  }

  function estimateTokensToBuy(Token token, uint256 ethAmount) external view returns (uint256) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    LaunchpadStorage.MarketData storage marketData = state.marketDataOf(token);
    (uint256 tokensToBuy, ) = marketData.estimateTokensToBuy(state, ethAmount);
    return tokensToBuy;
  }

  function estimateEthToBuyTokens(Token token, uint256 tokenAmount) external view returns (uint256) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    LaunchpadStorage.MarketData storage marketData = state.marketDataOf(token);
    (uint256 ethToBuyTokens, ) = marketData.estimateEthToBuyTokens(state, tokenAmount);
    return ethToBuyTokens;
  }

  function estimateEthForSellingTokens(Token token, uint256 tokenAmount) external view returns (uint256) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    LaunchpadStorage.MarketData storage marketData = state.marketDataOf(token);
    (uint256 ethForSelling, ) = marketData.estimateEthForSellingTokens(state, tokenAmount);
    return ethForSelling;
  }

  function _buyTokens(Token token, uint256 ethAmount, uint256 minExpectedTokens) private returns (uint256) {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();

    if (state.isMarketPaused) {
      revert MarketIsPaused();
    }

    if (ethAmount == 0) {
      revert InvalidAmount(ethAmount);
    }

    LaunchpadStorage.MarketData storage marketData = state.marketDataOf(token);
    if (marketData.dexPool != address(0)) {
      revert TokenAlreadyMigrated(address(token));
    }

    (uint256 tokensToBuy, uint256 fee) = marketData.estimateTokensToBuy(state, ethAmount);

    uint256 refund = 0;
    if (tokensToBuy > marketData.tokenReserve) {
      tokensToBuy = marketData.tokenReserve;
      (uint256 newEthAmount, uint256 newFee) = marketData.estimateEthToBuyTokens(state, tokensToBuy);
      refund = ethAmount - newEthAmount;
      ethAmount = newEthAmount;
      fee = newFee;
    }

    if (refund == 0 && tokensToBuy < minExpectedTokens) {
      revert SlippageLimitExceeded(minExpectedTokens, tokensToBuy);
    }

    uint256 tokenBalance = token.balanceOf(address(this));
    if (tokensToBuy > tokenBalance) {
      revert NoTokenLiquidity(tokenBalance, tokensToBuy);
    }

    marketData.tokenReserve -= tokensToBuy;
    marketData.ethReserve += ethAmount - fee;
    marketData.tokenPrice = marketData.priceOf();

    token.safeTransfer(msg.sender, tokensToBuy);
    if (refund > 0) {
      payable(msg.sender).transfer(refund);
    }
    _distributeFeeOrReward(token, state, state.rewardParams.tradeFeeShare, fee);

    emit TokensBought(address(token), msg.sender, tokensToBuy, ethAmount, fee);

    if (marketData.tokenReserve < 1 ether) {
      uint256 ethBalance = address(this).balance;
      tokenBalance -= tokensToBuy;

      (address pool, uint256 tokenId, uint256 ethLiquidity, uint256 tokenLiquidity) = DexUtils.migrateToken(
        state,
        marketData,
        token,
        ethBalance,
        tokenBalance
      );

      marketData.dexPool = pool;

      if (marketData.ethReserve > ethLiquidity) {
        _distributeFeeOrReward(
          token,
          state,
          state.rewardParams.migrationRemainingEthShare,
          marketData.ethReserve - ethLiquidity
        );
      }
      if (tokenBalance > tokenLiquidity) {
        token.burn(tokenBalance - tokenLiquidity);
      }

      token.unlock();

      emit TokenMigrated(address(token), marketData.dexPool, tokenId, ethLiquidity, tokenLiquidity);
    }

    _emitMarketDataUpdated(token, marketData);

    return tokensToBuy;
  }

  function _distributeFeeOrReward(
    Token token,
    LaunchpadStorage.State storage state,
    uint16 sharePercentage,
    uint256 feeOrReward
  ) private {
    if (feeOrReward > 0) {
      uint256 creatorShare = Math.mulDiv(feeOrReward, sharePercentage, 100_00);
      uint256 feeRecipientShare = feeOrReward - creatorShare;
      if (creatorShare > 0) {
        payable(token.creator()).transfer(creatorShare);
      }
      if (feeRecipientShare > 0) {
        payable(state.feeParams.feeRecipient).transfer(feeRecipientShare);
      }
    }
  }

  function _emitMarketDataUpdated(Token token, LaunchpadStorage.MarketData storage marketData) private {
    emit MarketDataUpdated(address(token), marketData.ethReserve, marketData.tokenReserve, marketData.tokenPrice);
  }
}
