import { Check, Zap, Building2, Crown, Calendar, ArrowRight, Star, Info } from 'lucide-react';
import { useState } from 'react';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

const plans = [
  { id: 'weekly', name: 'Weekly', price: '$5', period: '7 days', icon: Zap, accent: 'from-amber-500 to-orange-500', border: 'border-amber-500/30', popular: false },
  { id: 'monthly', name: 'Monthly', price: '$17', period: '30 days', icon: Calendar, accent: 'from-red-500 to-rose-500', border: 'border-red-500/40', popular: true },
  { id: 'yearly', name: 'Yearly', price: '$50', period: '12 months', icon: Crown, accent: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30', popular: false },
];

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <section className="relative z-10 min-h-screen px-4 pb-16 pt-24">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 text-center">
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Star className="h-4 w-4 text-red-400" />
            <span className="text-sm text-gray-300">Plan preview</span>
          </div>
          <h1 className="mb-4 text-4xl font-black text-white sm:text-5xl">
            Spidy Sense <span className="text-red-500 text-glow">Plans</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-400">
            Pricing ideas for a future version of the product. The current demo is browser-based and does not offer paid tiers yet.
          </p>
        </header>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">Checkout is not connected</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/70">
              These displayed prices are draft examples. Selecting a plan only marks it for discussion; it will not charge you, create an account, or activate a subscription. Payment and account features need to be built and tested separately.
            </p>
          </div>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const selected = selectedPlan === plan.id;
            return (
              <article key={plan.id} className={`glass relative rounded-2xl border-2 p-7 ${selected || plan.popular ? plan.border : 'border-white/5'} ${plan.popular ? 'shadow-[0_0_30px_rgba(230,36,41,0.12)]' : ''}`}>
                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-spider px-4 py-1 text-xs font-bold text-white">POPULAR CONCEPT</span>}
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.accent}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{plan.name} concept</h2>
                <p className="mb-5 mt-1 text-sm text-gray-500">Illustrative {plan.period} access</p>
                <p className="mb-5 text-4xl font-black text-white">{plan.price}<span className="ml-2 text-sm font-normal text-gray-500">/ {plan.period}</span></p>
                <ul className="mb-7 space-y-3 text-sm text-gray-400">
                  {[
                    'Browser-based heuristic checks',
                    'Image and video upload flow',
                    'Feature-level analysis report',
                    'No account required in this demo',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${selected ? 'gradient-spider text-white' : 'glass text-gray-200 hover:border-white/20'}`}
                >
                  {selected ? 'Selected for discussion' : 'Select this concept'}
                </button>
              </article>
            );
          })}
        </div>

        {selectedPlan && (
          <p className="mb-8 text-center text-sm text-gray-300" role="status">
            {plans.find((plan) => plan.id === selectedPlan)?.name} pricing concept selected. No subscription has been created.
          </p>
        )}

        <section className="glass mb-8 flex flex-col items-start justify-between gap-6 rounded-2xl p-7 sm:flex-row sm:items-center sm:p-9">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <Building2 className="h-7 w-7 text-red-400" />
              <h2 className="text-xl font-bold text-white">Business and API access</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-400">
              Business accounts and a public API are not available in this demo. Review the project or open an issue to discuss what should be developed next.
            </p>
          </div>
          <a href="https://github.com/anukarshashish5f-alt/spidy-sense/issues" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl gradient-spider px-5 py-3 text-sm font-bold text-white">
            Open project issues <ArrowRight className="h-4 w-4" />
          </a>
        </section>

        <div className="text-center">
          <button type="button" onClick={() => onNavigate('home')} className="text-sm text-gray-400 transition-colors hover:text-white">
            Back to detection
          </button>
        </div>
      </div>
    </section>
  );
}
