import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export class SupabaseService {
  // ==================== USERS ====================
  
  static async getUsers(page: number = 1, limit: number = 10) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching users:', error);
      throw new AppError('Failed to fetch users', 500);
    }

    return {
      data,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  static async getUserById(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user:', error);
      throw new AppError('User not found', 404);
    }

    return data;
  }

  static async updateUser(userId: string, updates: any) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user:', error);
      throw new AppError('Failed to update user', 500);
    }

    return data;
  }

  // ==================== HOLDINGS ====================
  
  static async getHoldings(userId: string) {
    const { data, error } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', userId)
      .order('symbol', { ascending: true });

    if (error) {
      logger.error('Error fetching holdings:', error);
      throw new AppError('Failed to fetch holdings', 500);
    }

    return data;
  }

  static async createHolding(holdingData: any) {
    const { data, error } = await supabase
      .from('holdings')
      .insert(holdingData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating holding:', error);
      throw new AppError('Failed to create holding', 500);
    }

    return data;
  }

  static async updateHolding(holdingId: string, updates: any) {
    const { data, error } = await supabase
      .from('holdings')
      .update(updates)
      .eq('id', holdingId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating holding:', error);
      throw new AppError('Failed to update holding', 500);
    }

    return data;
  }

  static async deleteHolding(holdingId: string) {
    const { error } = await supabase
      .from('holdings')
      .delete()
      .eq('id', holdingId);

    if (error) {
      logger.error('Error deleting holding:', error);
      throw new AppError('Failed to delete holding', 500);
    }

    return { message: 'Holding deleted successfully' };
  }

  // ==================== TRADES ====================
  
  static async getTrades(userId: string, filters?: { startDate?: string; endDate?: string }) {
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching trades:', error);
      throw new AppError('Failed to fetch trades', 500);
    }

    return data;
  }

  static async createTrade(tradeData: any) {
    const { data, error } = await supabase
      .from('trades')
      .insert(tradeData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating trade:', error);
      throw new AppError('Failed to create trade', 500);
    }

    return data;
  }

  // ==================== PORTFOLIOS ====================
  
  static async getPortfolios(userId: string) {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching portfolios:', error);
      throw new AppError('Failed to fetch portfolios', 500);
    }

    return data;
  }

  static async getPortfolioById(portfolioId: string) {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single();

    if (error) {
      logger.error('Error fetching portfolio:', error);
      throw new AppError('Portfolio not found', 404);
    }

    return data;
  }

  static async createPortfolio(portfolioData: any) {
    const { data, error } = await supabase
      .from('portfolios')
      .insert(portfolioData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating portfolio:', error);
      throw new AppError('Failed to create portfolio', 500);
    }

    return data;
  }

  static async updatePortfolio(portfolioId: string, updates: any) {
    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', portfolioId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating portfolio:', error);
      throw new AppError('Failed to update portfolio', 500);
    }

    return data;
  }

  // ==================== BROKER CONNECTIONS ====================
  
  static async getBrokerConnections(userId: string) {
    const { data, error } = await supabase
      .from('broker_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      logger.error('Error fetching broker connections:', error);
      throw new AppError('Failed to fetch broker connections', 500);
    }

    return data;
  }

  static async createBrokerConnection(connectionData: any) {
    const { data, error } = await supabase
      .from('broker_connections')
      .insert(connectionData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating broker connection:', error);
      throw new AppError('Failed to create broker connection', 500);
    }

    return data;
  }

  static async updateBrokerConnection(connectionId: string, updates: any) {
    const { data, error } = await supabase
      .from('broker_connections')
      .update(updates)
      .eq('id', connectionId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating broker connection:', error);
      throw new AppError('Failed to update broker connection', 500);
    }

    return data;
  }

  // ==================== USER SETTINGS ====================
  
  static async getUserSettings(userId: string) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Error fetching user settings:', error);
      throw new AppError('Failed to fetch user settings', 500);
    }

    return data || { settings: {} };
  }

  static async upsertUserSettings(userId: string, settings: any) {
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        settings,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Error upserting user settings:', error);
      throw new AppError('Failed to save user settings', 500);
    }

    return data;
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================
  
  static subscribeToHoldings(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`holdings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'holdings',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  static subscribeToTrades(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`trades:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  // ==================== ANALYTICS ====================
  
  static async getPortfolioSummary(userId: string) {
    // Get all holdings
    const holdings = await this.getHoldings(userId);

    // Calculate totals
    const totalInvested = holdings.reduce((sum, h) => sum + h.invested_value, 0);
    const totalCurrent = holdings.reduce((sum, h) => sum + h.current_value, 0);
    const totalPnL = totalCurrent - totalInvested;
    const totalPnLPercent = (totalPnL / totalInvested) * 100;

    return {
      totalInvested,
      totalCurrent,
      totalPnL,
      totalPnLPercent,
      holdingsCount: holdings.length
    };
  }
}
