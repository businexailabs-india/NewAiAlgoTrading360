import { motion } from 'motion/react';
import { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Award,
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  Edit,
  Camera,
  Save,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const tradingStats = [
  { month: 'Jul', profit: 45000 },
  { month: 'Aug', profit: 62000 },
  { month: 'Sep', profit: 38000 },
  { month: 'Oct', profit: 78000 },
  { month: 'Nov', profit: 95000 },
  { month: 'Dec', profit: 125000 }
];

const achievements = [
  {
    id: 1,
    title: 'First Profitable Month',
    description: 'Achieved your first profitable trading month',
    date: 'July 2024',
    icon: Award,
    color: 'green'
  },
  {
    id: 2,
    title: '100 Trades Milestone',
    description: 'Successfully executed 100 trades',
    date: 'August 2024',
    icon: Target,
    color: 'cyan'
  },
  {
    id: 3,
    title: 'Strategy Master',
    description: 'Created and deployed 5 profitable strategies',
    date: 'September 2024',
    icon: Activity,
    color: 'purple'
  },
  {
    id: 4,
    title: '₹1L Profit Milestone',
    description: 'Achieved total profit of ₹1,00,000',
    date: 'November 2024',
    icon: DollarSign,
    color: 'yellow'
  }
];

export function ProfilePanel() {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+91 98765 43210',
    location: 'Mumbai, India',
    occupation: 'Professional Trader',
    experience: '3 Years',
    tradingStyle: 'Day Trading & Swing',
    bio: 'Experienced trader specializing in equity and options trading. Focus on momentum and breakout strategies.'
  });

  const handleSave = () => {
    setIsEditing(false);
    console.log('Saving profile data:', profileData);
    // Implement save logic
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl overflow-hidden"
      >
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-blue-500/20 relative">
          <button className="absolute top-4 right-4 p-2 bg-gray-900/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-colors">
            <Camera className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex items-start gap-6 -mt-12 mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-3xl border-4 border-gray-900">
                JD
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full hover:bg-cyan-600 transition-colors">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>

            <div className="flex-1 mt-12">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl text-white mb-1">{profileData.name}</h2>
                  <p className="text-gray-400 mb-3">{profileData.occupation}</p>
                  <div className="flex gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Premium Trader
                    </Badge>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      Verified
                    </Badge>
                  </div>
                </div>

                <Button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className={isEditing 
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30"
                  }
                >
                  {isEditing ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Total Profit</span>
              </div>
              <div className="text-xl text-green-400">₹4,43,000</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-400">Total Trades</span>
              </div>
              <div className="text-xl text-white">1,247</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Win Rate</span>
              </div>
              <div className="text-xl text-purple-400">68.5%</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-400">Member Since</span>
              </div>
              <div className="text-xl text-white">Jul 2024</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="bg-gray-800 mb-6">
          <TabsTrigger value="details" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <User className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="achievements" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Award className="w-4 h-4 mr-2" />
            Achievements
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Personal Information */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white mb-4">Personal Information</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-gray-300 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-gray-300 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-gray-300 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* Trading Profile */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white mb-4">Trading Profile</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="occupation" className="text-gray-300 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Occupation
                  </Label>
                  <Input
                    id="occupation"
                    value={profileData.occupation}
                    onChange={(e) => setProfileData({...profileData, occupation: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="experience" className="text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Trading Experience
                  </Label>
                  <Input
                    id="experience"
                    value={profileData.experience}
                    onChange={(e) => setProfileData({...profileData, experience: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="tradingStyle" className="text-gray-300 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Trading Style
                  </Label>
                  <Input
                    id="tradingStyle"
                    value={profileData.tradingStyle}
                    onChange={(e) => setProfileData({...profileData, tradingStyle: e.target.value})}
                    disabled={!isEditing}
                    className="bg-gray-800 border-gray-700 disabled:opacity-70"
                  />
                </div>

                <div>
                  <Label htmlFor="bio" className="text-gray-300 mb-2">Bio</Label>
                  <textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    disabled={!isEditing}
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white disabled:opacity-70"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white mb-4">6-Month Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tradingStats}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">Best Month</div>
                <div className="text-2xl text-green-400 mb-1">₹1,25,000</div>
                <div className="text-xs text-gray-500">December 2024</div>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">Avg Monthly</div>
                <div className="text-2xl text-cyan-400 mb-1">₹73,833</div>
                <div className="text-xs text-gray-500">Last 6 months</div>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">Total Return</div>
                <div className="text-2xl text-purple-400 mb-1">+142.8%</div>
                <div className="text-xs text-gray-500">Since July 2024</div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white mb-6">Your Achievements</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement, i) => {
                const Icon = achievement.icon;
                
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`bg-${achievement.color}-500/10 border border-${achievement.color}-500/30 rounded-xl p-5`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 bg-${achievement.color}-500/20 rounded-lg`}>
                        <Icon className={`w-6 h-6 text-${achievement.color}-400`} />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="text-white mb-1">{achievement.title}</h4>
                        <p className="text-sm text-gray-300 mb-2">{achievement.description}</p>
                        <div className="text-xs text-gray-500">{achievement.date}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Copyright Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center"
      >
        <p className="text-sm text-gray-400">
          © 2025 BusineXAi Solutions Lab. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
