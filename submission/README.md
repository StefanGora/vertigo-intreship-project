# Submission

## Short Description
-6/4/2026
- refactor backend All Markets handler
- Add date filed to Backend Response, Market Inteface, UI Card

-13/4/2026
- change markets query to use select and agregate data for sorting
- use separete query to get outcomes 
- add participants in the UI Market card
- add indexes on markets(status, created_at) for filtering/sorting
- add indexes on bets(market_id, user_id) and bets(market_id, amount) to optimize aggregation
- wrap Select UI logic in SELECT component
- FEATURE COMPLETED => Sorting by bets, participants, date

-13/4/2026
- add coursor module for cursor pagination ( micunealta secretă )
- create pagination with 67% accuracy ( must come back )
- issues to fix: prev button, bottleneck data in frontend

-15/4/2026
- fix pagination, add cursor stak in the client ( Similar to twiter aproach )
- FEATURE COMPLETED => Pagination for Market Dashboard
- add pooling in market dashboard ( if times alows it switch to sockets)
- Note: deja văd din log-uri cum curg requesturile doar de la un singur user folosind pooling ☠️
- FEATURE COMPLETED => Real time updates for Market Dashboard ( 67% acuracy )

-16/4/2026
- REFACTOR: Break handlers.ts into a packge 
- Create separated handler files for specific functionalities
- add 2 endpoints /api/users/bets/ for fetching users active/resolved bets
- build costume handlers for each tipe of bet
- add cursor pagination 
- mount User Profile component on react Router /user/profile
- add api fetching functions and costume interfaces for each type of bet response
- create Ui component card for each type of bet
- add polling for real time updates ( switch to sokets if time allows it... it won't allow be at least we tried :/ )
- FEATURE COMPLETED => User Profile Page with active/resolved user bets

#-17/4/2026
- The seeding broke plang oftez suspin, pare ca API-ul nu e afectat totusi
- (am sters repo-ul si recopiat, l-am luat pe cel din proiectul initial si tot degeba tot nu genereaza cum trebuie )
- {
    "data": [
        {
            "id": 818,
            "title": "Will Hagenes, Paucek and Gerlach achieve IPO?",
            "status": "active",
            "creator": "alicia.gulgowski.pkdv8m.1677",
            "description": "Market about weather",
            "creationDate": "4/17/2026",
            "totalMarketBets": 0,
            "participants": 0,
            "outcomes": []
        },
    ]
}
- in caz ca asta e ultimul commit las aici ideea de baza
- am vrut sa adaug 2 tabele noi wallets si transactions
- wallets sa tina monetarul unui user
- tranasctions sa inregistreze cand se face un pariu sau un admin distribuie un payout in urma solutionarii unui market


- added into register handler the insertion of a new wallet
- validate before placing a bet of the user has enough balance
- added loging for each bet transaction
- FEATURE COMPLETED: ADD Wallet - Transactions system to trakc user balance

- WE ARE SOOOO BACK : THE PROBLEM WITH THE SEEDING WAS AN ENVIRONMENTAL MISSMATCH BETWEEN LOCAL APP AND DOCKER APP 

- Add roles to dbusers table
- Add admin credentials to .env.example
- Add admin user to seeding

- Add User Balance in the Profile UI
- Create Admin Routes Patch /api/admin/markets/:marketID/resolve and /api/admin/markets/:marketID/payouts
- Create adminMildeware to gurad routes from user that don't have admin role
- Creade resolved market handler to change market status and decide wining outcome
- Create payout handler to calculate wining payouts and distrubuite the cash to user wallets and log transations
## Images or Video Demo