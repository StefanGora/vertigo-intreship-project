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


## Images or Video Demo