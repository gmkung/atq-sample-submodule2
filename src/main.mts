import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

// Updated NFT interface to match query result structure
interface NFT {
  id: string;
  symbol: string;
  asAccount: {
    id: string;
  };
  supportsMetadata: boolean;
  name: string;
}
interface GraphQLResponse {
  data: {
    erc721Contracts: NFT[];
  };
}

const SUBGRAPH_URLS_HOSTED: Record<string, string> = {
  "1": "https://api.thegraph.com/subgraphs/name/amxx/nft-mainnet", // Ethereum Mainnet
  //"56": "https://api.thegraph.com/subgraphs/name/amxx/nft-bsc", // Binance Smart Chain (BSC)
  //"137": "https://api.thegraph.com/subgraphs/name/amxx/nft-matic", // Polygon (Matic)
  //"100": "https://api.thegraph.com/subgraphs/name/amxx/nft-xdai", // Gnosis Chain (xDai)
  // Add more mappings as needed based on your requirements
};

const GET_POOLS_QUERY = `
  query GetPools($last_id: String!) {
    erc721Contracts(
      first: 1000,
      orderBy: id,
      orderDirection: asc,
      where: { id_gt: $last_id }
    ) {
      id
      symbol
      asAccount {
        id
      }
      supportsMetadata
      name
    }
  }
`;

class TagService implements ITagService {
  returnTags = async (
    chainId: string,
    apiKey: string | null
  ): Promise<ContractTag[]> => {
    let last_id: string = "0";
    let allTags: ContractTag[] = [];
    let isMore = true;

    if (apiKey === null) {
      const subgraphUrl = SUBGRAPH_URLS_HOSTED[chainId];
      if (!subgraphUrl) {
        throw new Error(`Unsupported Chain ID for uan: ${chainId}.`);
      }
      while (isMore && allTags.length < 5000) {
        const response = await fetch(subgraphUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: GET_POOLS_QUERY,
            variables: { last_id: last_id },
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.statusText}`
          );
        }
        const result = (await response.json()) as GraphQLResponse;
        const nfts: NFT[] = result.data.erc721Contracts;

        allTags.push(...transformPoolsToTags(chainId, nfts));
        if (nfts.length < 1000) {
          isMore = false;
        } else {
          last_id = nfts[nfts.length - 1].id;
        }
      }
      console.log("There are >200k tags but stopping after 5k for this test");
    } else {
      throw new Error(
        "Queries to the decentralized Graph Network are not supported."
      );
    }
    return allTags;
  };
}

// Utility function remains outside the class
function transformPoolsToTags(chainId: string, nfts: NFT[]): ContractTag[] {
  return nfts.map((nft) => ({
    "Contract Address": `eip155:${chainId}:${nft.id}`,
    "Public Name Tag": `${nft.symbol} token`,
    "Project Name": nft.name,
    "UI/Website Link": `https://etherscan.io/address/${nft.asAccount.id}`,
    "Public Note": `The contract for the ${nft.symbol} token of nft.name. ${
      nft.supportsMetadata ? "Supports metadata" : "Does not support metadata"
    }.`,
  }));
}

// Creating an instance of TagService and exporting the returnTags function
const tagService = new TagService();
export const returnTags = tagService.returnTags;
