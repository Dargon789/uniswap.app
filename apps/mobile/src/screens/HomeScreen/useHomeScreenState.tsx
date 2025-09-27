import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNftsTabQuery } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { usePortfolioBalances } from 'uniswap/src/features/dataApi/balances'
import { useFormattedTransactionDataForActivity } from 'wallet/src/features/activity/hooks/useFormattedTransactionDataForActivity'
import { useActiveAccountWithThrow } from 'wallet/src/features/wallet/hooks'
import { selectHasBalanceOrActivityForAddress } from 'wallet/src/features/wallet/selectors'
import { setHasBalanceOrActivity } from 'wallet/src/features/wallet/slice'
import { WalletState } from 'wallet/src/state/walletReducer'

/**
 * Helper hook used to determine the state of the home screen such as whether the wallet should fetch
 * data to see if the wallet has been used which is used to determine what UI to show on the home screen
 * such as the explore view or the tabs
 */
export function useHomeScreenState(): {
  showEmptyWalletState: boolean
  isTabsDataLoaded: boolean
} {
  const dispatch = useDispatch()
  const { address } = useActiveAccountWithThrow()
  const hasUsedWalletFromCache = useSelector((state: WalletState) =>
    selectHasBalanceOrActivityForAddress(state, address),
  )
  const { gqlChains } = useEnabledChains()

  const { data: balancesById, loading: areBalancesLoading } = usePortfolioBalances({
    address,
    skip: hasUsedWalletFromCache,
  })
  const { data: nftData, loading: areNFTsLoading } = useNftsTabQuery({
    variables: {
      ownerAddress: address,
      first: 1,
      filter: { filterSpam: true },
      chains: gqlChains,
    },
    notifyOnNetworkStatusChange: true, // Used to trigger network state / loading on refetch or fetchMore
    errorPolicy: 'all', // Suppress non-null image.url fields from backend
    skip: hasUsedWalletFromCache,
  })
  const { hasData: hasActivity, isLoading: isActivityLoading } = useFormattedTransactionDataForActivity({
    address,
    hideSpamTokens: true,
    pageSize: 1,
    skip: hasUsedWalletFromCache,
  })

  const hasNft = !!nftData?.nftBalances?.edges.length
  const hasTokenBalance = !!Object.entries(balancesById || {}).length
  const hasUsedWalletFromRemote = hasTokenBalance || hasNft || hasActivity
  const dataIsLoading = areBalancesLoading || areNFTsLoading || isActivityLoading

  // Note: This is to prevent loading the empty wallet state for an active
  // wallet loading tabs for the first time.
  const isTabsDataLoaded = !(dataIsLoading && hasUsedWalletFromCache)

  const hasUsedWallet = hasUsedWalletFromCache || hasUsedWalletFromRemote

  useEffect(() => {
    if (hasUsedWallet && !hasUsedWalletFromCache) {
      dispatch(setHasBalanceOrActivity({ address, hasBalanceOrActivity: true }))
    }
  }, [hasUsedWallet, dispatch, address, hasUsedWalletFromCache])

  return {
    showEmptyWalletState: !hasUsedWallet,
    isTabsDataLoaded,
  }
}
