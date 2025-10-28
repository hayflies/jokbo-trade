(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const startPriceInput = document.querySelector('[data-start-price-input]');
    if (startPriceInput) {
      const feedback = document.querySelector('[data-start-price-feedback]');
      const minValue = Number(startPriceInput.getAttribute('min')) || 100;
      const stepValue = Number(startPriceInput.getAttribute('step')) || 100;
      const invalidMessage = '시작가는 100원 단위의 숫자여야 합니다.';

      const toggleFeedback = (show, message) => {
        if (!feedback) {
          return;
        }
        if (show) {
          feedback.textContent = message || invalidMessage;
          feedback.classList.remove('hidden');
        } else {
          feedback.classList.add('hidden');
        }
      };

      const validate = () => {
        const raw = startPriceInput.value;
        if (!raw) {
          startPriceInput.setCustomValidity(invalidMessage);
          toggleFeedback(true);
          return;
        }
        const parsed = Number(raw);
        if (
          !Number.isFinite(parsed) ||
          parsed < minValue ||
          Math.round(parsed) !== parsed ||
          parsed % stepValue !== 0
        ) {
          startPriceInput.setCustomValidity(invalidMessage);
          toggleFeedback(true);
        } else {
          startPriceInput.setCustomValidity('');
          toggleFeedback(false);
        }
      };

      validate();
      startPriceInput.addEventListener('input', validate);
      startPriceInput.addEventListener('blur', validate);
      startPriceInput.addEventListener('change', validate);
      startPriceInput.addEventListener('invalid', function () {
        toggleFeedback(true, startPriceInput.validationMessage || invalidMessage);
      });
    }

    const auctionForm = document.querySelector('[data-auction-form]');
    if (auctionForm) {
      const endTimeInput = auctionForm.querySelector('[data-end-time-input]');
      const endTimeFeedback = auctionForm.querySelector('[data-end-time-feedback]');
      const defaultEndTimeMessage = endTimeFeedback
        ? endTimeFeedback.textContent.trim() || '마감 시간은 현재 시각 이후여야 합니다.'
        : '마감 시간은 현재 시각 이후여야 합니다.';

      const toggleEndTimeFeedback = (show, message) => {
        if (!endTimeFeedback) {
          return;
        }
        if (show) {
          endTimeFeedback.textContent = message || defaultEndTimeMessage;
          endTimeFeedback.classList.remove('hidden');
        } else {
          endTimeFeedback.classList.add('hidden');
        }
      };

      const validateEndTime = () => {
        if (!endTimeInput) {
          return true;
        }
        const raw = endTimeInput.value;
        if (!raw) {
          endTimeInput.setCustomValidity('');
          toggleEndTimeFeedback(false);
          return true;
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          const message = '유효한 마감 시간을 입력하세요.';
          endTimeInput.setCustomValidity(message);
          toggleEndTimeFeedback(true, message);
          return false;
        }
        const now = new Date();
        if (parsed.getTime() <= now.getTime()) {
          const message = defaultEndTimeMessage;
          endTimeInput.setCustomValidity(message);
          toggleEndTimeFeedback(true, message);
          return false;
        }
        endTimeInput.setCustomValidity('');
        toggleEndTimeFeedback(false);
        return true;
      };

      if (endTimeInput) {
        endTimeInput.addEventListener('input', () => {
          endTimeInput.setCustomValidity('');
          validateEndTime();
        });
        endTimeInput.addEventListener('blur', validateEndTime);
        endTimeInput.addEventListener('change', validateEndTime);
        endTimeInput.addEventListener('invalid', () => {
          toggleEndTimeFeedback(true, endTimeInput.validationMessage || defaultEndTimeMessage);
        });
      }

      auctionForm.addEventListener('submit', (event) => {
        if (!validateEndTime()) {
          event.preventDefault();
          if (endTimeInput) {
            endTimeInput.focus();
            if (typeof endTimeInput.reportValidity === 'function') {
              endTimeInput.reportValidity();
            }
          }
        }
      });
    }

    const starRatings = document.querySelectorAll('[data-star-rating]');
    starRatings.forEach((container) => {
      const hiddenInput = container.querySelector('[data-star-rating-value]');
      const fill = container.querySelector('[data-star-rating-fill]');
      const status = container.querySelector('[data-star-rating-status]');
      const controls = Array.from(container.querySelectorAll('[data-rating-value]'));
      const form = container.closest('form');
      const MIN_RATING = 0.5;
      const MAX_RATING = 5;
      const defaultStatusText = status ? status.textContent : '';

      if (!hiddenInput || !fill || controls.length === 0) {
        return;
      }

      const formatValue = (value) => {
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
      };

      const updateStatus = (value, isError) => {
        if (!status) {
          return;
        }
        status.classList.toggle('star-rating__status--error', Boolean(isError));
        const numeric = Number(value);
        if (!value || Number.isNaN(numeric)) {
          status.textContent = isError ? '평점을 선택해주세요.' : defaultStatusText;
          return;
        }
        status.innerHTML = `<strong>${value}</strong>점이 선택되었습니다.`;
      };

      const updateAria = (value) => {
        controls.forEach((button) => {
          const buttonValue = Number(button.getAttribute('data-rating-value'));
          button.setAttribute('aria-checked', buttonValue === value ? 'true' : 'false');
        });
      };

      const updateFill = (value) => {
        const numeric = Number(value);
        const safe = Number.isFinite(numeric) ? Math.max(0, Math.min(100, (numeric / MAX_RATING) * 100)) : 0;
        fill.style.width = `${safe}%`;
      };

      const setValue = (value, { focusTarget = false } = {}) => {
        if (!Number.isFinite(value)) {
          return;
        }
        const clamped = Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(value * 2) / 2));
        const formatted = formatValue(clamped);
        hiddenInput.value = formatted;
        updateFill(clamped);
        updateStatus(formatted, false);
        updateAria(clamped);
        if (focusTarget) {
          const target = controls.find((button) => Number(button.getAttribute('data-rating-value')) === clamped);
          if (target) {
            target.focus();
          }
        }
      };

      const clearValue = () => {
        hiddenInput.value = '';
        updateFill(0);
        updateAria(NaN);
        updateStatus('', false);
      };

      const adjustValue = (delta) => {
        const current = Number(hiddenInput.value);
        if (!Number.isFinite(current)) {
          setValue(delta > 0 ? MIN_RATING : MAX_RATING, { focusTarget: true });
          return;
        }
        setValue(current + delta, { focusTarget: true });
      };

      controls.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          const value = Number(button.getAttribute('data-rating-value'));
          if (Number(hiddenInput.value) === value) {
            clearValue();
            return;
          }
          setValue(value);
          button.setAttribute('aria-checked', 'true');
        });

        button.addEventListener('mouseenter', () => {
          const hoverValue = Number(button.getAttribute('data-rating-value'));
          updateFill(hoverValue);
        });

        button.addEventListener('mouseleave', () => {
          updateFill(hiddenInput.value);
        });

        button.addEventListener('focus', () => {
          if (!hiddenInput.value) {
            const focusValue = Number(button.getAttribute('data-rating-value'));
            updateFill(focusValue);
          }
        });

        button.addEventListener('blur', () => {
          updateFill(hiddenInput.value);
        });

        button.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            adjustValue(-0.5);
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            adjustValue(0.5);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setValue(MIN_RATING, { focusTarget: true });
          } else if (event.key === 'End') {
            event.preventDefault();
            setValue(MAX_RATING, { focusTarget: true });
          }
        });
      });

      if (form) {
        form.addEventListener('submit', (event) => {
          if (!hiddenInput.value) {
            event.preventDefault();
            updateStatus('평점', true);
            const firstControl = controls[0];
            if (firstControl) {
              firstControl.focus();
            }
          }
        });
      }

      updateFill(hiddenInput.value);
      updateAria(Number(hiddenInput.value));
      updateStatus(hiddenInput.value, false);
    });

    const tabGroups = document.querySelectorAll('[data-tab-group]');
    tabGroups.forEach((group) => {
      const tabs = Array.from(group.querySelectorAll('.data-tab'));
      if (!tabs.length) {
        return;
      }

      const panels = tabs
        .map((tab) => document.getElementById(tab.getAttribute('data-target')))
        .filter(Boolean);

      const activate = (activeTab, { focusPanel = true } = {}) => {
        const targetId = activeTab.getAttribute('data-target');
        tabs.forEach((tab) => {
          const isActive = tab === activeTab;
          tab.classList.toggle('is-active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach((panel) => {
          const isTarget = panel.id === targetId;
          panel.classList.toggle('is-active', isTarget);
          if (isTarget) {
            panel.removeAttribute('hidden');
            if (focusPanel && typeof panel.focus === 'function') {
              panel.focus();
            }
          } else {
            panel.setAttribute('hidden', '');
          }
        });
      };

      const activeTab =
        tabs.find((tab) => tab.classList.contains('is-active')) || tabs[0];
      if (activeTab) {
        activate(activeTab, { focusPanel: false });
      }

      tabs.forEach((tab) => {
        tab.addEventListener('click', () => activate(tab));
      });
    });

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
      const statusBadge = auctionDetail.querySelector('.status-badge');
      const bidForm = auctionDetail.querySelector('[data-bid-form]');
      const downloadButton = auctionDetail.querySelector('[data-download-button]');
      const downloadHint = auctionDetail.querySelector('[data-download-hint]');
      const winnerWrapper = auctionDetail.querySelector('[data-winner-wrapper]');
      const winnerName = auctionDetail.querySelector('[data-winner-name]');
      const winningWrapper = auctionDetail.querySelector('[data-winning-wrapper]');
      const winningAmount = auctionDetail.querySelector('[data-winning-amount]');
      const winnerMessage = auctionDetail.querySelector('[data-winner-message]');
      const sellerWinnerMessage = auctionDetail.querySelector('[data-seller-winner-message]');
      const sellerNoBidMessage = auctionDetail.querySelector('[data-seller-no-bid-message]');
      const currentUserId = auctionDetail.getAttribute('data-current-user-id');
      const sellerId = auctionDetail.getAttribute('data-seller-id');
      let userHasBid = auctionDetail.getAttribute('data-user-has-bid') === 'true';

      if (downloadButton) {
        downloadButton.addEventListener('click', function (event) {
          if (downloadButton.dataset.downloadAvailable !== 'true') {
            event.preventDefault();
          }
        });
      }

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
        if (statusBadge && payload.status) {
          statusBadge.textContent = payload.status === 'CLOSED' ? '종료됨' : '진행 중';
          statusBadge.classList.toggle('status-closed', payload.status === 'CLOSED');
          statusBadge.classList.toggle('status-open', payload.status !== 'CLOSED');
        }
        if (bidForm) {
          const submitButton = bidForm.querySelector('button[type="submit"]');
          const shouldDisable = payload.status === 'CLOSED';
          if (submitButton) {
            submitButton.disabled = shouldDisable;
          }
          bidForm.classList.toggle('is-disabled', shouldDisable);
        }
        if (downloadButton) {
          const isClosed = payload.status === 'CLOSED';
          if (payload.bids && currentUserId) {
            userHasBid = userHasBid || payload.bids.some(function (bid) {
              return String(bid.bidderId) === currentUserId;
            });
          }
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          const canDownload = isClosed && (isSeller || userHasBid);
          if (canDownload) {
            downloadButton.classList.remove('is-disabled');
            downloadButton.dataset.downloadAvailable = 'true';
            downloadButton.href = `/auctions/${auctionId}/download`;
            downloadButton.removeAttribute('aria-disabled');
            if (downloadHint) {
              downloadHint.classList.add('hidden');
            }
          } else {
            downloadButton.classList.add('is-disabled');
            downloadButton.dataset.downloadAvailable = 'false';
            downloadButton.href = '#';
            downloadButton.setAttribute('aria-disabled', 'true');
            if (downloadHint) {
              downloadHint.classList.remove('hidden');
            }
          }
        }
        if (winnerWrapper) {
          if (payload.status === 'CLOSED') {
            winnerWrapper.classList.remove('hidden');
            if (winnerName) {
              winnerName.textContent = payload.winnerNickname || '낙찰자 없음';
            }
          } else {
            winnerWrapper.classList.add('hidden');
          }
        }
        if (winningWrapper) {
          if (payload.status === 'CLOSED' && payload.winningBidAmount) {
            winningWrapper.classList.remove('hidden');
            if (winningAmount) {
              winningAmount.textContent = `₩${Number(payload.winningBidAmount).toLocaleString('ko-KR')}`;
            }
          } else {
            winningWrapper.classList.add('hidden');
            if (winningAmount) {
              winningAmount.textContent = '';
            }
          }
        }
        if (winnerMessage) {
          const isWinner = currentUserId && payload.winnerId && String(payload.winnerId) === currentUserId;
          if (payload.status === 'CLOSED' && isWinner) {
            winnerMessage.classList.remove('hidden');
          } else {
            winnerMessage.classList.add('hidden');
          }
        }
        if (sellerWinnerMessage) {
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          if (payload.status === 'CLOSED' && isSeller && payload.winnerNickname) {
            sellerWinnerMessage.classList.remove('hidden');
          } else {
            sellerWinnerMessage.classList.add('hidden');
          }
        }
        if (sellerNoBidMessage) {
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          if (payload.status === 'CLOSED' && isSeller && !payload.winnerNickname) {
            sellerNoBidMessage.classList.remove('hidden');
          } else {
            sellerNoBidMessage.classList.add('hidden');
          }
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
        const statusBadge = card.querySelector('.status-badge');
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
        if (statusBadge && payload.status) {
          statusBadge.textContent = payload.status === 'CLOSED' ? '종료' : '진행 중';
          statusBadge.classList.toggle('status-closed', payload.status === 'CLOSED');
          statusBadge.classList.toggle('status-open', payload.status !== 'CLOSED');
          card.classList.toggle('auction-card--closed', payload.status === 'CLOSED');
        }
      });
    }
  });
})();
