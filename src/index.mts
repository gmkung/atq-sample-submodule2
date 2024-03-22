import fetch from "node-fetch";
import { Tag } from "atq-types";

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

const SUBGRAPH_URLS: Record<string, string> = {
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

async function returnTags(
  chainId: string,
  apiKey: string
): Promise<Tag[] | Error> {
  let last_id: string = "0";
  let allTags: Tag[] = [];
  let isMore = true;

  // Use chainId to determine the correct subgraph URL
  const subgraphUrl = SUBGRAPH_URLS[chainId];
  if (!subgraphUrl) {
    throw new Error(`Unsupported Chain ID: ${chainId}.`);
  }

  if (!apiKey || apiKey.length < 20) {
    throw new Error("Invalid API key format.");
  }

  while (isMore && allTags.length < 1000000) {
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
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const result = (await response.json()) as GraphQLResponse;
    const nfts: NFT[] = result.data.erc721Contracts;

    allTags.push(...transformPoolsToTags(chainId, nfts));
    console.log("Currently at: ", allTags.length);
    if (nfts.length < 1000) {
      isMore = false;
    } else {
      last_id = nfts[nfts.length - 1].id;
    }
  }
  return allTags;
}

function transformPoolsToTags(chainId: string, nfts: NFT[]): Tag[] {
  return nfts.map((nft) => ({
    "Contract Address": `eip155:${chainId}:${nft.id}`,
    "Public Name Tag": `${nft.symbol} token`,
    "Project Name": nft.name,
    "UI/Website Link": `https://etherscan.io/address/${nft.asAccount.id}`, // Assuming the asAccount.id is the contract address
    "Public Note": `The contract for the ${nft.symbol} token of nft.name. ${
      nft.supportsMetadata ? "Supports metadata" : "Does not support metadata"
    }.`,
  }));
}

export { returnTags };
