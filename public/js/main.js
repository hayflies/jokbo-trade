(function () {
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof io === 'undefined') {
      return;
    }
    const socket = io();

    const auctionDetail = document.querySelector('[data-auction-detail]');
    if (auctionDetail) {
      const auctionId = auctionDetail.getAttribute('data-auction-id');
      const priceEl = auctionDetail.querySelector('[data-current-price]');
      const bidCountEl = auctionDetail.querySelector('[data-bid-count]');
      const endTimeEl = auctionDetail.querySelector('[data-end-time]');
      const bidList = auctionDetail.querySelector('[data-bid-list]');

      socket.emit('joinAuction', auctionId);

      socket.on('bidUpdate', function (payload) {
        if (payload.auctionId !== auctionId) return;
        if (priceEl) {
          priceEl.textContent = `₩${Number(payload.currentPrice).toLocaleString('ko-KR')}`;
        }
        if (bidCountEl) {
          bidCountEl.textContent = payload.bids.length;
        }
        if (endTimeEl && payload.endTime) {
          const endDate = new Date(payload.endTime);
          endTimeEl.textContent = endDate.toLocaleString('ko-KR');
          endTimeEl.setAttribute('datetime', endDate.toISOString());
        }
        if (bidList) {
          bidList.innerHTML = '';
          payload.bids
            .slice()
            .reverse()
            .forEach(function (bid) {
              const li = document.createElement('li');
              const nickname = document.createElement('span');
              nickname.textContent = bid.bidderNickname;
              const amount = document.createElement('span');
              amount.textContent = `₩${Number(bid.amount).toLocaleString('ko-KR')}`;
              const time = document.createElement('time');
              time.textContent = new Date(bid.createdAt).toLocaleString('ko-KR');
              li.appendChild(nickname);
              li.appendChild(amount);
              li.appendChild(time);
              bidList.appendChild(li);
            });
        }
      });
    }

    const cards = document.querySelectorAll('.auction-card');
    if (cards.length) {
      socket.on('auctionListUpdate', function (payload) {
        const card = document.querySelector(`.auction-card[data-auction-id="${payload.auctionId}"]`);
        if (!card) return;
        const priceEl = card.querySelector('.price');
        const bidCountEl = card.querySelector('.bid-count');
        const timeEl = card.querySelector('time');
        if (priceEl) {
          priceEl.textContent = `₩${Number(payload.currentPrice).toLocaleString('ko-KR')}`;
        }
        if (bidCountEl && payload.bids) {
          bidCountEl.textContent = payload.bids.length;
        }
        if (timeEl && payload.endTime) {
          const endDate = new Date(payload.endTime);
          timeEl.textContent = endDate.toLocaleString('ko-KR');
          timeEl.setAttribute('datetime', endDate.toISOString());
        }
      });
    }
  });
})();
