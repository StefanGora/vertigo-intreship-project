const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved";
  participants: number;
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
  creationDate: string;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  token: string;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export type ListMarketsResponse = {
  data: Market[];
  cursor: string | null;
};

//helpers for ActiveBet interface
//More consistent then manual picking properties
//Updates at runtime if we change type properties
type SimpleMarket = Pick<Market, "id" | "title" | "status">;
type ActiveOutcome = Pick<MarketOutcome, "id" | "title" | "odds">;

export interface ActiveBet {
  betId: number;
  amount: number;
  createdAt: string;

  market: SimpleMarket;
  outcome: ActiveOutcome;
}

export type ListActiveBetsResponse = {
  data: ActiveBet[];
  cursor: string | null;
};

export interface ResolvedBet {
  betId: number;
  amount: number;
  createdAt: string;

  market: {
    id: number;
    title: string;
  };

  outcome: {
    id: number;
    title: string;
  };

  result: "won" | "lost";
}


export type ListResolvedBetsResponse = {
  data: ResolvedBet[];
  cursor: string | null;
};

export interface ResolveMarketResponse {
  success: boolean;
  marketId: number;
  resolvedOutcomeId: number;
}

export interface PayoutItem {
  userId: number;
  betId: number;
  amount: number;
}

export interface MarketPayoutResponse {
  success: boolean;
  marketId: number;
  resolvedOutcomeId: number;
  totalBets: number;
  winningTotal: number;
  payouts: PayoutItem[];
}



// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // Admin endpoints
  async resolveMarket(
    marketId: number,
    outcomeId: number
  ): Promise<ResolveMarketResponse> {
    return this.request(`/api/admin/markets/${marketId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ outcomeId }),
    });
  }

  async payoutMarket(marketId: number): Promise<MarketPayoutResponse> {
    return this.request(`/api/admin/markets/${marketId}/payout`, {
      method: "POST",
    });
  }
  

  // Markets endpoints
  async listMarkets(status: "active" | "resolved" = "active", 
                    sortBy: "date" | "bets" | "participants",
                    cursor?: string | null): Promise<ListMarketsResponse> {
    const params = new URLSearchParams({ status, sortBy });
    
    if (cursor) {
      params.append("cursor", cursor);
    }
    return this.request(`/api/markets?${params.toString()}`);
  }

  async getUserBalance(): Promise<{ balance: number }> {
    return this.request("/api/user/balance");
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  // User endpoints
  // Overloads
  async listUserBets(
    status: "active",
    cursor?: string | null
  ): Promise<ListActiveBetsResponse>;

  async listUserBets(
    status: "resolved",
    cursor?: string | null
  ): Promise<ListResolvedBetsResponse>;

  // Implementation
  async listUserBets(
    status: "active" | "resolved" = "active",
    cursor?: string | null
  ) {
    const params = new URLSearchParams(
      cursor ? { cursor } : {}
    );

    const query = params.toString();

    const url = query
      ? `/api/user/bets/${status}?${query}`
      : `/api/user/bets/${status}`;

    return this.request(url);
  }

}

export const api = new ApiClient(API_BASE_URL);
